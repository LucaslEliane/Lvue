import parseHTML from './parseHTML';

const mustacheText = new RegExp('(\{\{([^\}(?=\})]*)\}\})', 'g');
const vForReg = new RegExp('^(\.+)(of|in)\\s+([\\w\-]+)');

function checkAndRemoveAttribute(element, attrName) {
  const node = element;
  if (node.attribute && node.attribute[attrName]) {
    const value = node.attribute[attrName];
    const status = delete node.attribute[attrName];
    if (status) {
      return {
        status,
        value,
      };
    }
  }
  return {
    status: false,
  };
}

function processPre(element) {
  const node = element;
  const handled = checkAndRemoveAttribute(element, 'v-pre');
  if (handled.status) {
    node.pre = true;
    return true;
  }
  return false;
}

function processRawTemplate(element) {
  const node = element;
  if (node.VAttribute) {
    const VAttributeKeys = Object.keys(node.VAttribute);
    const attributeLength = VAttributeKeys.length;
    if (!node.attribute) {
      node.attribute = {};
    }
    for (let i = 0; i < attributeLength; i += 1) {
      node.attribute[VAttributeKeys[i]] = node.VAttribute[VAttributeKeys[i]];
    }
    delete node.VAttribute;
  }
}

function processMustacheText(element) {
  const node = element;
  if (node.text) {
    const text = node.text;
    let matchResult = null;
    while (matchResult = mustacheText.exec(text)) {
      const str = matchResult[1];
      const data = matchResult[2].trim();
      if (!node.data) {
        node.data = {};
      }
      node.data[data] = {
        str,
        value: null,
      };
    }
  }
}

function processIfCondition(element) {
  const result = checkAndRemoveAttribute(element, 'v-if');
  if (result.status) {
    const node = element;
    const value = result.value;
    node.if = value;
  }
}

function getIfConditionErrorMsg(prevSibling) {
  if (prevSibling) {
    return prevSibling.type;
  }
  return 'as the first child';
}

function processElseIfCondition(element, prevSibling) {
  const result = checkAndRemoveAttribute(element, 'v-else-if');
  if (result.status) {
    const node = element;
    if (!prevSibling || (prevSibling && !prevSibling.if && !prevSibling.elseIf)) {
      const message = getIfConditionErrorMsg(prevSibling);
      throw new Error(
        `${node.type} element's else if condition muse after a` +
        ' have a prevSibling with if or else-if condition ' +
        `expression, but ${message} element is illegal!`,
      );
    }
    const value = result.value;
    node.elseIf = value;
  }
}

function processElseCondition(element, prevSibling) {
  const result = checkAndRemoveAttribute(element, 'v-else');
  if (result.status) {
    const node = element;
    if (!prevSibling || (prevSibling && !prevSibling.if && !prevSibling.elseIf)) {
      const message = getIfConditionErrorMsg(prevSibling);
      throw new Error(
        `${node.type} element's else condition must after a` +
        ' have a prevSibling with if or else-if condition ' +
        `expression, but ${message} element is illegal!`,
      );
    }
    node.else = true;
  }
}

function processSimpleVAttribute(element, name, hasV) {
  const node = element;
  let attrName = name;
  if (hasV) {
    attrName = `v-${attrName}`;
  }
  const result = checkAndRemoveAttribute(node, attrName);
  if (result.value) {
    node[name] = result.value;
  }
}

function checkVFor(value) {
  if (vForReg.test(value)) {
    return vForReg.exec(value);
  }
  return false;
}

function processForIterator(element) {
  const node = element;
  const result = checkAndRemoveAttribute(element, 'v-for');
  if (result.value) {
    const vFor = checkVFor(result.value);
    if (vFor) {
      node.for = {
        iteratorType: vFor[2].trim(),
        result: vFor[1].trim(),
        iterator: vFor[3].trim(),
      };
    } else {
      throw new Error(
        `The v-for expression in ${node.type} element` +
        ' is illegal, please checkout.',
      );
    }
  }
}

function checkInFor(element) {
  if (element.parent && !!element.parent.for) {
    return true;
  }
  return false;
}

function processRef(element) {
  const node = element;
  const result = checkAndRemoveAttribute(node, 'ref');
  if (result.status && (checkInFor(node) || node.type === 'template')) {
    throw new Error(
      `${node.type} element cannot have a ref attribute in` +
      ' template element or parent element with for attribute.',
    );
  }
  if (result.status) {
    node.ref = result.value;
  }
}

function processSlot(element) {
  const node = element;
  if (node.type === 'slot') {
    const slotName = checkAndRemoveAttribute(node, 'name');
    if (slotName.value) {
      node.slotName = slotName.value;
    }
  } else {
    const slot = checkAndRemoveAttribute(node, 'slot');
    if (slot.value) {
      node.slot = slot.value;
    }
  }
}

/**
 * @description 将模板字符串解析成对象保存在内存中，对于一些特殊的
 * 属性，需要特殊处理，将其进行解析，挂载到对象上
 * 
 * @param {string} template 模板字符串
 * @return {object} {
 *   ast: 解析得到的语法树，每一个节点都是一个对象，文本节点除外。
 * } 
 */

const parse = function parse(template) {
  const html = template.trim();
  const parentStack = [];
  let isPre = false;
  let prevParent = null;
  let prevSibling = null;

  const ast = parseHTML(html, {
    start(element, isTagClose) {
      const tagClose = isTagClose;
      const node = element;

      node.parent = prevParent;
      if (!isPre) {
        isPre = processPre(node);
      }

      if (isPre || node.type === 'style' || node.type === 'script') {
        processRawTemplate(node);
      } else {
        processIfCondition(node);
        processElseCondition(node, prevSibling);
        processElseIfCondition(node, prevSibling);
        processForIterator(node);
        processSimpleVAttribute(node, 'key', false);
        processSimpleVAttribute(node, 'show', true);
        processSimpleVAttribute(node, 'once', true);
        processRef(node);
        processSlot(node);
      }
      /**
       * 判断当前进入操作的标签是否是一个非自闭合标签，如果是一个非自闭合
       * 标签的话，那么就需要将这个标签入栈，让后续标签可以将这个标签对象
       * 设置为自己的父元素。
       * 
       * 父元素要晚一些设置，防止影响当前组件的parent元素设置。
       */

      if (tagClose) {
        parentStack.push(node);
        prevParent = parentStack[parentStack.length - 1];
      }

      /**
       * 如果当前传入的元素已经完成了遍历，也就是一个已经闭合的标签，那么这个标签
       * 元素可以作为下一个需要处理的元素的前一个子元素，这个元素的作用主要是
       * 用作if..else if..else的判断功能的。
       */
      if (node.DONE) {
        prevSibling = node;
      }

      if (prevParent) {
        node.root = false;
      } else {
        node.root = true;
      }
    },
    close(element) {
      parentStack.pop();
      prevParent = parentStack[parentStack.length - 1];
      prevSibling = element;
      if (!element.pre) {
        processMustacheText(element);
      }
    },
  });

  if (ast.length !== 1) {
    throw new Error(
      'template just can have a root node, and your template' +
      ` string have ${ast.length} root node, please set a wrapper.`,
    );
  }
  return ast[0];
};

export default parse;
