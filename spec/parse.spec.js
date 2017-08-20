import parse from '../src/compiler/parse';
import chai from 'chai';

const expect = chai.expect;

const fullHTML ='<template>\n' +
                  '<!DOCTYPE HTML>\n' +
                  '<html>\n' +
                    '<head>\n' +
                      '<meta charset="utf-8">\n' +
                      '<style>\n' +
                        '.container {\n' +
                          'height: 200px;\n' +
                        '}\n' +
                      '</style>\n' +
                      '<script src="http://bootcdn/bootstrap/bootstrap.js"></script>\n' +
                    '</head>\n' +
                    '<body>\n' +
                      '<!-- a comment node -->\n' +
                      '<div class="container" @click="goHome()" ref="container">\n' +
                        'This is a div\n' +
                        '<slot name="header"></slot>\n' +
                      '</div>\n' +
                      '<ul class="iterator" v-for="item in items">{{ item }}</ul>\n' +
                      '<div class="container" aria-hidden slot="header" key="container">\n' +
                        '<div class="internal">\n' +
                          'This is internal div\n' +
                        '</div>\n' +
                        '<div>\n' +
                          '<img src="http://img1" v-if="ok">\n' +
                          '<img src="http://img2" v-else-if="ok">\n' +
                          '<img src="http://img3" v-else>\n' +
                        '</div>\n' +
                      '</div>\n' +
                    '</body>\n' +
                  '</html>\n' +
              '</template>';

describe('一个完成的HTML解析过程，包含和模板字符串相关的所有内容', function() {
  const ast = parse(fullHTML).children;

  const doctype = ast[0];

  const html = ast[1];
  const style = html.children[0].children[1];
  const body = html.children[1];

  const comment = body.children[0];
  const slotContainer = body.children[1];
  const slot = slotContainer.children[0];
  const ul = body.children[2];
  const deepDiv = body.children[3];

  const internalDiv = deepDiv.children[0];
  const imgArray = deepDiv.children[1].children;

  const img1 = imgArray[0];
  const img2 = imgArray[1];
  const img3 = imgArray[2];

  it('DOCTYPE部分', function() {
    expect(doctype).to.deep.include({
      type: 'DOCTYPE',
      value: 'HTML',
    });
  });

  it('head部分', function() {
    expect(style.text).to.be.equal('.container {\nheight: 200px;\n}');
  });

  it('body & comment部分', function() {
    expect(body.children.length).to.be.equal(4);

    expect(comment).to.include({
      type: 'COMMENT',
      DONE: true,
      value: ' a comment node ',
    });
  });

  it('含有ref的 slot div部分', function() {
    expect(slotContainer).to.deep.include({
      type: 'div',
      ref: 'container',
      attribute: {
        class: 'container',
      },
      VAttribute: {
        '@click': 'goHome()',
      },
    });

    expect(slot).to.deep.include({
      type: 'slot',
      DONE: true,
      slotName: 'header',
    });

  });

  it('for迭代列表部分', function() {
    expect(ul).to.deep.include({
      type: 'ul',
      'for': {
        iteratorType: 'in',
        result: 'item',
        iterator: 'items',
      },
      attribute: {
        class: 'iterator',
      },
      data: {
        item: {
          value: null,
          str: '{{ item }}',
        },
      },
    });
  });

  it('具有深度的div部分，包含slot, key, if, else if, else', function() {
    expect(deepDiv).to.deep.include({
      type: 'div',
      slot: 'header',
      key: 'container',
      attribute: {
        class: 'container',
        'aria-hidden': true,
      },
    });


    expect(internalDiv).to.deep.include({
      type: 'div',
      text: 'This is internal div',
      attribute: {
        class: 'internal',
      },
    });


    expect(img1).to.deep.include({
      type: 'img',
      DONE: true,
      if: 'ok',
      attribute: {
        src: 'http://img1',
      }
    });

    expect(img2).to.deep.include({
      type: 'img',
      DONE: true,
      elseIf: 'ok',
      attribute: {
        src: 'http://img2',
      },
    });

    expect(img3).to.deep.include({
      type: 'img',
      DONE: true,
      else: true,
      attribute: {
        src: 'http://img3',
      },
    });

  });
});

describe('会出现错误的情况\n', function() {
  const wrapperFn = function(template) {
    return function() {
      parse(template);
    }
  };
  it('html模板字符串不仅有一个根节点\n', function() {
    const template = '<!DOCTYPE HTML><html></html>';
    const wrapper = wrapperFn(template);
    expect(wrapper).to.throw(Error);
    expect(wrapper).to.throw(/2 root node/);
  })
  it('html模板字符串不合法\n', function() {
    const template = '<html></div>';
    const wrapper = wrapperFn(template);
    expect(wrapper).to.throw(Error);
    expect(wrapper).to.throw(/template string is illegal/);
  });
  
  it('html字符串属性不合法\n', function() {
    const template = '<div class="aaa></div>';
    const wrapper = wrapperFn(template);
    expect(wrapper).to.throw(Error);
    expect(wrapper).to.throw(/template string is illegal/);
  });

  it('模板中的ref不合法\n', function() {
    const template = '<div v-for="item in items"><a ref="link"/></div>';
    const wrapper = wrapperFn(template);
    expect(wrapper).to.throw(Error);
    expect(wrapper).to.throw(/a ref attribute/);
  });

  it('模板中的for不合法\n', function() {
    const template = '<div v-for="i in "></div>';
    const wrapper = wrapperFn(template);
    expect(wrapper).to.throw(Error);
    expect(wrapper).to.throw(/v-for expression/);
  });

  it('模板中的if..else if..else不合法\n仅有 else 没有 if', function() {
    const templateNoIf = '<div></div><div v-else></div>';
    const wrapperNoIf = wrapperFn(templateNoIf);
    expect(wrapperNoIf).to.throw(/div element is illegal/);
  });

  it('模板中的if...else if...else不合法\n仅有else if 没有 if', function() {
    const templateNoIfElse = '<div></div><div v-else-if="ok"></div>';
    const wrapperNoIfElse = wrapperFn(templateNoIfElse);
    expect(wrapperNoIfElse).to.throw(/div element is illegal/);
  });

  it('模板中的if...else if...else不合法\n没有上一个兄弟元素', function() {
    const templateNoSibling = '<div v-else></div>';
    const wrapperNoSibling = wrapperFn(templateNoSibling);
    expect(wrapperNoSibling).to.throw(/as the first child/);
  });
});