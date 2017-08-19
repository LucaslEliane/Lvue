const tname = '([\\w][\\w\-]*)';
const startTagOpen = new RegExp(`^\\s*<${tname}`);
const startTagClose = new RegExp('^\\s*\/?>');
const openTagEnd = new RegExp(`^\\s*</${tname}>`);
const commentTag = new RegExp('^\\s*<!--([\\s\\S]*)-->');
const doctypeTag = new RegExp('^\\s*<!DOCTYPE([^>]*)>');
const textNode = new RegExp('[^<\/]+');

const attribute = new RegExp(`^\\s*${tname}(?:\\s*=\s*([\"\'])([^\"\']*)\\2)?`);
const DomNode = function DomNode(type, ...args) {
  this.DONE = false;
  switch (type) {
    case 'DOCTYPE':
    case 'COMMENT':
      this.type = type;
      this.value = args[0];
      break;
    default:
      this.type = type;
  }
};
DomNode.prototype.setAttribute = function setAttribute(name, value) {
  if (!this.attribute) {
    this.attribute = {};
  }
  this.attribute[name] = value;
};
DomNode.prototype.setChildren = function setChildren(nodeList) {
  // 由于之前出栈的顺序和孩子节点的本身的顺序是相反的，所以这里设置children的时候需要将
  // 传入的参数数组的顺序反向一下。
  this.children = [].concat(nodeList).reverse();
};
DomNode.prototype.setText = function setText(text) {
  this.text = text;
};
// 对于闭合的HTML标签，需要确定其是否已经被搜索完成，否则在出栈操作的时候会导致匹配出现混乱。
DomNode.prototype.searchDONE = function searchDONE() {
  this.DONE = true;
};
/**
 * HTML模板的编译函数，可以将具有Vue语法的模板编译成render函数。
 * 
 * @param {string} template LVue的模板字符串 
 * @return {Array:[DomNode]} 这个对象包含所有节点被解析完成后的一个数组
 */
const parseHTML = function parseHTML(template) {
  const htmlStack = [];
  const html = template;
  let lastHtml = html.trim();
  while (lastHtml.length) {
    let matchResult;
    if (matchResult = doctypeTag.exec(lastHtml)) {
      htmlStack.push(new DomNode('DOCTYPE', matchResult[1].trim()));
      lastHtml = lastHtml.replace(matchResult[0], '').trim();
      continue;
    }
    if (matchResult = commentTag.exec(lastHtml)) {
      htmlStack.push(new DomNode('COMMENT', matchResult[1]));
      lastHtml = lastHtml.replace(matchResult[0], '').trim();
      continue;
    }
    if (matchResult = startTagOpen.exec(lastHtml)) {
      htmlStack.push(new DomNode(matchResult[1]));
      lastHtml = lastHtml.replace(matchResult[0], '').trim();
      while (!startTagClose.test(lastHtml)) {
        const att = attribute.exec(lastHtml);
        if (!att) {
          throw new Error('template string is illegal');
        }
        const attrName = att[1].trim();
        if (att[3]) {
          const attrValue = att[3].trim();
          htmlStack[htmlStack.length - 1].setAttribute(attrName, attrValue);
        } else {
          htmlStack[htmlStack.length - 1].setAttribute(attrName, true);
        }
        lastHtml = lastHtml.replace(att[0], '').trim();
      }
      const close = startTagClose.exec(lastHtml);
      lastHtml = lastHtml.replace(close[0], '').trim();
      continue;
    }
    if (matchResult = openTagEnd.exec(lastHtml)) {
      const type = matchResult[1].trim();
      const childrenArray = [];
      let popNode = htmlStack.pop();
      while ((popNode.type !== type || popNode.DONE) && htmlStack.length) {
        childrenArray.push(popNode);
        popNode = htmlStack.pop();
      }
      if (popNode.type !== type) {
        throw new ReferenceError('template string is illegal');
      }
      popNode.setChildren(childrenArray);
      popNode.searchDONE();
      htmlStack.push(popNode);
      lastHtml = lastHtml.replace(matchResult[0], '').trim();
      continue;
    }
    if (matchResult = textNode.exec(lastHtml)) {
      htmlStack[htmlStack.length - 1].setText(matchResult[0].trim());
      lastHtml = lastHtml.replace(matchResult[0], '').trim();
      continue;
    }
    if (lastHtml.trim().length === 0) {
      throw new ReferenceError('template string is illegal');
    }
  }
  return htmlStack;
};

export default parseHTML;
