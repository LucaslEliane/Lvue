## 分几步实现一个简单的响应式前端框架(一)：template parse

### 前言

这几篇博客写于17年8月正在准备找工作的时候，由于之前看过React的源代码，并且这时最流行的响应式前端框架主要有两个，其一是React，由facebook主导的一个开源项目，另外一个是Vue，是yyx大神自己开始架构的一个开源项目。所以希望对Vue的源码也有一定的了解，就准备着手自己实现一个简单的响应式框架。其实也是在阅读Vue源码的时候对于其核心部分逻辑的一个拆解和简化，帮助自己更好的理解Vue在构建和更新过程中的操作。

当然由于还没有工作经验，写出来的代码会有一些简陋，但是希望能够让自己在使用Vue的时候，更好的理解其中内部的原理，而不是简单的使用。

### React和Vue的响应式区别

这里的响应式指的是当数据层发生了变化的时候，表现层能够根据数据变化得到相应的改变，来适应数据的变化，而通过阅读了一部分的关键源代码，了解到了这两个最流行的前端框架对于数据改变的响应方式的区别。

由于React项目架构较早，其使用的是自己的一套状态管理，所有组件的状态都通过`state`保存在虚拟DOM中，也就是将组件最为实例对象保存在浏览器内存当中，当我们调用`setState`的时候，其会响应状态的变化，将新的状态合并到旧的状态中，来实现组件实例的更新，再通过`render`函数来渲染出真正的DOM挂载到页面中。而所有的子组件通过获取父组件传递的`props`来响应父组件状态的变化。

而Vue通过组件初始化时设置的一些状态属性，使用存取器`getter/setter`来拦截对于状态的修改，通过收集依赖，将所有的更新发送到各个组件来进行更新，由于Vue对于状态更新的操作要远远少于React(当然React对于自己状态的比较采用了很多优化的方法)，所以Vue整体上来说要比React稍微简单一些。所以本次实现主要根据Vue文档中的各种方法来进行实现。

### Vue

Vue的方法和使用就不多赘述了，在官方文档中都具有比较完整的方法接口和描述。

主要的实现结构：

* 使用模板来创建`render`函数，当然也可以手动进行，因为模板的学习成本还是要小于React的JSX语法的。并且当前React使用了非常多的ES6语法，还是有着一定的学习成本的。
* 使用`getter/setter`来拦截状态修改，更新UI。
* 使用发布/订阅设计模式来进行响应式操作。

本次的实现也是基于上面几点，不知道什么时候能够完成，但是在慢慢研读源码和写代码的过程中也会对自己的代码能力和编程思想有很大的提升。希望自己能够完成这一系列博客。由于现在ES6的支持率已经很高了，而且我自己的环境基本已经支持所有的ES6语言，并且还有babel神器可以进行代码的编译，所以下面所有的代码都会基于原生ES6的语法来进行实现。但不会使用ES6的`class`来进行类的实现，还是自己控制原型比较习惯。

### 模板解析

首先，由于组件渲染的结果都是根据模板来进行的，那么对于模板的解析是非常重要的，如何将一个HTML模板解析为JavaScript可以识别的语法也是这个项目最基本的事情。

可以先来看一下Vue的`render()`函数是什么样子的。

```javascript
Vue.component('heading', {
  render: function(createElement) {
    return createElement(
      'h1',
      {
        'class': {
          foo: true,
          bar: false,
        },
        attrs: {
          id: 'foo',
        },
      },
      [
        createElement(
          ....
        )
      ]
    )
  }
});
```

`render`函数通过参数传入的内置的`createElement`函数来构建新的实例DOM，而`createElement`和React基本是一致的，第一个参数是一个字符串，表示组件的名称、或者是一个组件对象，那么就会直接使用这个组件对象。当然在模板字符串编译出来`render`函数中只应该含有字符串参数。

第二个参数是一个对象，这个对象包含了这个组件所有的属性，这个属性可能是绑定属性，也可能是原生属性。

第三个参数是一个数组，这个数组表示了某个组件内部的子元素列表，这些列表就是递归的`createElement`函数调用，这样每一个自定义组件都可以通过这样的迭代来得到一个完成的实例对象。下面就来将模板解析成这样一个函数。

### 模板解析的实现

一个合法的HTML标签格式应该有下面几种：

1. `<!DOCTYPE xxxxx>`用来指定文档的渲染格式。
2. 自闭的HTML标签`<xx />`，这类标签不含有子元素，比如常用的img标签、meta标签。
3. 闭合的HTML标签`<xx></xx>`，这类标签可以含有子元素，是最常用的一种标签类型。
4. comment的HTML标签`<!-- xxx -->`，这类标签代表HTML的注释。

使用`while`来对整个模板字符串进行处理，对于各种情况进行拦截，直到所有的拦截函数都失效，这时判断整个template字符串是否被完整解析，如果还有剩余的非空字符，那么就可以知道这个template字符串是不符合标准的了，那么就抛出一个异常。

然后将所有解析的结果保存在AST中，每个DOM节点对应一个AST中的对象。每个对象含有template解析出来的文本、属性、标签名等信息。

要生成一个AST，就需要使用栈来实现，比如当遇到了一个`<div>`标签的时候，这个标签在解析完属性之后，被推入栈，然后之后解析的内容都会是这个标签的子节点，并且全部入栈，直到遇到了一个`</div>`标签，然后对于栈中的元素挨个出栈，直到遇到了匹配的第一个`<div>`标签为止。

[具体的HTML解析代码可以看这里](../src/compiler/parseHTML.js)

```javascript
// 模板解析的伪代码
while(lastHtml.length) {
  if (doctypeRegExp.test(lastHtml)) {
    // doctype string handle code
  }
  if (commentRegExp.test(lastHtml)) {
    // comment string handle code
  }
  if (selfCloseTag.test(lastHtml)) {
    // 自闭合标签的处理
    while (attribute.test(lastHtml)) {
      // 处理属性
    }
  }
  if (commonTagStart.test(lastHtml))  {
    // 处理一般标签的起始标签
    while (attribute.test(lastHtml)) {
      // 处理属性
    }
  }
  if (commonTagEnd.test(lastHtml)) {
    // 处理一般标签的结束标签
  }
  // 如果前面的逻辑都被跳过了，那也说明了template字符串具有不能解析的
  // 地方，那这个template字符串就是不合法的，抛出一个错误
}
```

### v-属性解析

对于一般的属性，可以直接将其保存到抽象语法树(AST)的节点上，而对于一些框架内置的属性，需要额外的处理，比如具有`v-for`属性的标签，其子标签不能够含有`ref`属性，又比如具有`v-else`属性的标签的上一个兄弟标签必须要包含合法的`v-if`属性。

这些属性的额外处理需要包含一些全局属性来进行设置，比如当前节点的父节点，或者当前节点的前一个兄弟节点，所以这些方法用闭包传入到`parseHTML`函数中，这样在调用的时候就可以保证一个解析的全局状态了。

对于v-属性的额外的解析操作可以配合上面的HTML解析的代码，看这里[v-属性解析，也是HTML解析的wrapper函数](../src/compiler/parse.js)

### 构建`render`函数

最终返回的信息不能够是框架不能识别的AST，所以还需要将构建好的AST转换为`render`函数来帮助进行组件的渲染过程，`render`函数的具体形式在上面都已经给出了，在进行`render`的时候，需要剥离出来各种框架属性，然后设置组件的各种状态。

这些工作在v-属性解析的时候已经完成了大半，还剩下一些额外的处理。

构建的`render`函数需要传入`createElement()`函数作为参数来进行组件的构建。

在Vue中，编译出来的`render`函数其实是这样的：

```javascript
function anonymous() {
  with(this){
    return _c('div', [
      _c('span', [
        _v(_s(msg))
      ])
    ])
  }
}
```

由于构建函数的时候，需要大量的进行字符串的拼接操作，所以最后得到的`render`其实是一系列函数调用的字符串，而为了尽可能缩减这个字符串的长度，并且对于字符串，让其执行的时候切换到指定的上下文，这里使用了并不安全的`with`来进行上下文的切换，并且将所有的函数都替换成了`_c`、`_s`这样的函数名，在调用上下文中将这些函数赋值为正常的函数就可以了。

对于不同类型的节点，在渲染过程中的操作可能会有很大差别，所以很难对于大块的代码进行复用，这里基本上对于每一种类型都有相关的处理函数。这些函数都是后面需要实现的。当然在实现的时候对于一些组件或者方法会进行一定的简化。

这种方法在很多框架中都有过使用，React在编译JSX的时候也使用了这样的方法。然后在返回`render`函数的时候将其包装在一个匿名函数中就可以对其进行执行了。

这些渲染相关的函数在组件的声明周期当中很可能会被调用多次，为了在可能的情况下对编译出来的框架的大小进行缩减，这样也是一个很好的方法。

Vue渲染相关的函数列表：

```javascript
Vue.prototype._c = createElement
Vue.prototype._o = markOnce
Vue.prototype._n = toNumber
Vue.prototype._s = toString
Vue.prototype._l = renderList
Vue.prototype._t = renderSlot
Vue.prototype._q = looseEqual
Vue.prototype._i = looseIndexOf
Vue.prototype._m = renderStatic
Vue.prototype._f = resolveFilter
Vue.prototype._k = checkKeyCodes
Vue.prototype._b = bindObjectProps
Vue.prototype._v = createTextVNode
Vue.prototype._e = createEmptyVNode
Vue.prototype._u = resolveScopedSlots
```

### 总结

这个部分的代码需要比较清晰的逻辑来对template语法进行解析，并且需要比较了解正则表达式，这里面基本运用了所有正则表达式的特性。

解析完成的结果可以通过单元测试来进行自动测试。
[mocha的单元测试用例--parseHTML。](../spec/parseHTML.spec.js)
[mocha的单元测试用例--parse。](../spec/parseHTML.spec.js)

