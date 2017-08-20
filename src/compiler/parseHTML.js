const tname = '([\\w][\\w\-]*)';
const aname = '([\\w\:\@][\\w\-\:\.]*)';
const startTagOpen = new RegExp(`^\\s*<${tname}`);
const startTagClose = new RegExp('^\\s*\/?>');
const openTagEnd = new RegExp(`^\\s*</${tname}>`);
const matchTag = new RegExp(`^\\s*<(${tname})[^>]*>[\\s\\S]*</\\1>`);
const commentTag = new RegExp('^\\s*<!--([\\s\\S]*)-->');
const doctypeTag = new RegExp('^\\s*<!DOCTYPE([^>]*)>');
const textNode = new RegExp('[^<\/]+');

const attribute = new RegExp(`^\\s*${aname}(?:\\s*=\s*([\"\'])([^\"\']*)\\2)?`);
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
  let attributeType = null;
  if (~name.indexOf(':') || ~name.indexOf('@')) {
    attributeType = 'VAttribute';
  } else {
    attributeType = 'attribute';
  }
  if (!this[attributeType]) {
    this[attributeType] = {};
  }
  this[attributeType][name] = value;
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

function isVoidTag(lastHtml) {
  const html = lastHtml;
  return !matchTag.test(html);
}

function handleVoidTag(htmlStack, matchResult, html) {
  let lastHtml = html;
  const currentDomNode = new DomNode(matchResult[1]);
  htmlStack.push(currentDomNode);
  lastHtml = lastHtml.replace(matchResult[0], '').trim();
  while (!startTagClose.test(lastHtml)) {
    const att = attribute.exec(lastHtml);
    if (!att) {
      throw new Error('template string is illegal');
    }
    const attrName = att[1].trim();
    if (att[3]) {
      const attrValue = att[3].trim();
      currentDomNode.setAttribute(attrName, attrValue);
    } else {
      currentDomNode.setAttribute(attrName, true);
    }
    lastHtml = lastHtml.replace(att[0], '').trim();
  }
  const close = startTagClose.exec(lastHtml);
  currentDomNode.searchDONE();
  lastHtml = lastHtml.replace(close[0], '').trim();
  return lastHtml;
}

function handleStartTag(htmlStack, matchResult, html) {
  let lastHtml = html;
  const currentDomNode = new DomNode(matchResult[1]);
  htmlStack.push(currentDomNode);
  lastHtml = lastHtml.replace(matchResult[0], '').trim();
  while (!startTagClose.test(lastHtml)) {
    const att = attribute.exec(lastHtml);
    if (!att) {
      throw new Error('template string is illegal');
    }
    const attrName = att[1].trim();
    if (att[3]) {
      const attrValue = att[3].trim();
      currentDomNode.setAttribute(attrName, attrValue);
    } else {
      currentDomNode.setAttribute(attrName, true);
    }
    lastHtml = lastHtml.replace(att[0], '').trim();
  }
  const close = startTagClose.exec(lastHtml);
  lastHtml = lastHtml.replace(close[0], '').trim();
  return lastHtml;
}

function handleComment(htmlStack, matchResult, html) {
  let lastHtml = html;
  const commentNode = new DomNode('DOCTYPE', matchResult[1].trim());
  htmlStack.push(commentNode);
  commentNode.searchDONE();
  lastHtml = lastHtml.replace(matchResult[0], '').trim();
  return lastHtml;
}

function handleDoctype(htmlStack, matchResult, html) {
  let lastHtml = html;
  const doctypeNode = new DomNode('COMMENT', matchResult[1]);
  htmlStack.push(doctypeNode);
  doctypeNode.searchDONE();
  lastHtml = lastHtml.replace(matchResult[0], '').trim();
  return lastHtml;
}
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
      lastHtml = handleComment(htmlStack, matchResult, lastHtml);
      continue;
    }
    if (matchResult = commentTag.exec(lastHtml)) {
      lastHtml = handleDoctype(htmlStack, matchResult, lastHtml);
      continue;
    }
    if (matchResult = startTagOpen.exec(lastHtml)) {
      if (isVoidTag(lastHtml)) {
        lastHtml = handleVoidTag(htmlStack, matchResult, lastHtml);
      } else {
        lastHtml = handleStartTag(htmlStack, matchResult, lastHtml);
      }
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
