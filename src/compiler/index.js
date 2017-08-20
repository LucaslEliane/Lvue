import parse from './parse';
// import generatorRender from './generatorRender';

const createCompiler = function createCompiler(template, options) {
  const ast = parse(template, options);
  // const render = generatorRender(ast);
  return {
    ast,
    // render,
  };
};

export default createCompiler;
