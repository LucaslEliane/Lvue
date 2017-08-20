import chai from 'chai';
import parseHTML from '../src/compiler/parseHTML';

const expect = chai.expect;

const singleDoc = '<!DOCTYPE HTML>';
const singleComment = '<!-- aaaaaa -->';
const singleHTML = '<html> aaa </html>';
const htmlSlice = '<body><div>This is a div<img /></div><span>This is a span</span><!-- This is a piece of comment --></body>'
const htmlFull = '<!DOCTYPE HTML>\n<html>\n<head>\n<meta charset="utf-8">\n<style>\n.container { height: 200px; }\n' +
  '</style>\n<script src="http://bootcdn/bootstrap/bootstrap.js">\n</script>\n</head>\n<body>\n<div class="container">\n' +
  'This is a div</div><div class="container" aria-hidden @click="goHome()">\n' +
  '<img src="http://xxx"/><div class="internal" v-bind:class="name" @click.prevent="goHome()">This is internal div' +
  '</div></div></body></html>';

describe('不含有属性的HTML解析测试', function() {
  it('一个单独的DOCTYPE标签', function() {
    const parseResult = parseHTML(singleDoc);
    const length = parseResult.length;
    const type = parseResult[0].type;
    const value = parseResult[0].value;
    expect(length).to.be.equal(1);
    expect(type).to.be.equal('DOCTYPE');
    expect(value).to.be.equal('HTML');
  });

  it('一个单独的comment标签', function() {
    const parseResult = parseHTML(singleComment);
    const type = parseResult[0].type;
    const value = parseResult[0].value;
    expect(type).to.be.equal('COMMENT');
    expect(value).to.be.equal(' aaaaaa ');
  });

  it('一个单独的element标签', function() {
    const parseResult = parseHTML(singleHTML);
    const type = parseResult[0].type;
    const text = parseResult[0].text;
    expect(type).to.be.equal('html');
    expect(text).to.be.equal('aaa');
  });

  it('一个比较复杂的不含属性的HTML字符串', function() {
    const parseResult = parseHTML(htmlSlice);
    const body = parseResult[0];
    const div = body.children[0];
    const img = div.children[0];
    const span = body.children[1];
    const comment = body.children[2];
    expect(body.type).to.be.equal('body');
    expect(div.type).to.be.equal('div');
    expect(img.type).to.be.equal('img');
    expect(span.type).to.be.equal('span');
    expect(comment.type).to.be.equal('COMMENT');
    expect(div.text).to.be.equal('This is a div');
    expect(span.text).to.be.equal('This is a span');
    expect(comment.value).to.be.equal(' This is a piece of comment ');
  });
});

describe('含有所有类型属性和标签的HTML', function() {
  it('一个标准格式的HTML', function() {
    const parseResult = parseHTML(htmlFull);
    const length = parseResult.length;
    expect(length).to.be.equal(2);
    const doc = parseResult[0];
    expect(doc).to.include({
      type: 'DOCTYPE',
      value: 'HTML',
      DONE: true,
    });

    const html = parseResult[1];
    const head = html.children[0];
    expect(head.children.length).to.be.equal(3);

    const meta = head.children[0];

    expect(meta).to.deep.include({
      type: 'meta',
      DONE: true,
      attribute: {
        charset: 'utf-8',
      },
    });

    const style = head.children[1];
    expect(style.text).to.be.equal('.container { height: 200px; }');

    const script = head.children[2];
    expect(script).to.deep.include({
      type: 'script',
      DONE: true,
      attribute: {
        src: 'http://bootcdn/bootstrap/bootstrap.js',
      },
    });

    const body = html.children[1];
    expect(body.children.length).to.be.equal(2);

    const firstContainer = body.children[0];
    const secondContainer = body.children[1];
    expect(firstContainer).to.deep.include({
      text: 'This is a div',
      DONE: true,
      attribute: {
        class: 'container',
      },
    });

    expect(secondContainer).to.deep.include({
      type: 'div',
      DONE: true,
      attribute: {
        class: 'container',
        'aria-hidden': true,
      },
      VAttribute: {
        '@click': 'goHome()',
      },
    });

    const img = secondContainer.children[0];
    expect(img).to.deep.include({
      type: 'img',
      DONE: true,
      attribute: {
        src: 'http://xxx',
      },
    });
    const internalDiv = secondContainer.children[1];
    expect(internalDiv).to.deep.include({
      type: 'div',
      DONE: true,
      attribute: {
        class: 'internal',
      },
      VAttribute: {
        'v-bind:class': 'name',
        '@click.prevent': 'goHome()',
      },
      text: 'This is internal div',
    });
  });
});