export default {
  name: 'root',
  primitives: [
    {
      name: '+',
      returnType: 'Number',
      argumentTypes: ['Number', 'Number'],
    }, {
      name: '-',
      returnType: 'Number',
      argumentTypes: ['Number', 'Number'],
    }, {
      name: '*',
      returnType: 'Number',
      argumentTypes: ['Number', 'Number'],
    }, {
      name: '/',
      returnType: 'Number',
      argumentTypes: ['Number', 'Number'],
    }, {
      name: 'sqr',
      returnType: 'Number',
      argumentTypes: ['Number'],
    }, {
      name: 'sqrt',
      returnType: 'Number',
      argumentTypes: ['Number'],
    }, {
      name: 'string-length',
      returnType: 'Number',
      argumentTypes: ['String'],
    }, {
      name: 'string-append',
      returnType: 'String',
      argumentTypes: ['String', 'String'],
    }, {
      name: 'star',
      returnType: 'Image',
      argumentTypes: ['Number', 'String', 'String'],
    }, {
      name: 'circle',
      returnType: 'Image',
      argumentTypes: ['Number', 'String', 'String'],
    }, {
      name: 'triangle',
      returnType: 'Image',
      argumentTypes: ['Number', 'String', 'String'],
    }, {
      name: 'square',
      returnType: 'Image',
      argumentTypes: ['Number', 'String', 'String'],
    }, {
      name: 'rectangle',
      returnType: 'Image',
      argumentTypes: ['Number', 'Number', 'String', 'String'],
    }, {
      name: 'ellipse',
      returnType: 'Image',
      argumentTypes: ['Number', 'Number', 'String', 'String'],
    }, {
      name: 'text',
      returnType: 'Image',
      argumentTypes: ['Number', 'String', 'String'],
    }, {
      name: 'rotate',
      returnType: 'Image',
      argumentTypes: ['Number', 'Image'],
    }, {
      name: 'scale',
      returnType: 'Image',
      argumentTypes: ['Number', 'Image'],
    }, {
      name: 'overlay',
      returnType: 'Image',
      argumentTypes: ['Image', 'Image'],
    }, {
      name: 'overlay/xy',
      returnType: 'Image',
      argumentTypes: ['Image', 'Number', 'Number', 'Image'],
    }, {
      name: 'put-image',
      returnType: 'Image',
      argumentTypes: ['Image', 'Number', 'Number', 'Image'],
    }, {
      name: 'bitmap/url',
      returnType: 'Image',
      argumentTypes: ['String'],
    }, {
      name: '=',
      returnType: 'Boolean',
      argumentTypes: ['Number', 'Number'],
    }, {
      name: '<',
      returnType: 'Boolean',
      argumentTypes: ['Number', 'Number'],
    }, {
      name: '>',
      returnType: 'Boolean',
      argumentTypes: ['Number', 'Number'],
    }, {
      name: '<=',
      returnType: 'Boolean',
      argumentTypes: ['Number', 'Number'],
    }, {
      name: '>=',
      returnType: 'Boolean',
      argumentTypes: ['Number', 'Number'],
    }, {
      name: 'string=?',
      returnType: 'Boolean',
      argumentTypes: ['string', 'string'],
    }, {
      name: 'and',
      returnType: 'Boolean',
      argumentTypes: ['Boolean', 'Boolean'],
    }, {
      name: 'or',
      returnType: 'Boolean',
      argumentTypes: ['Boolean', 'Boolean'],
    },
  ]
};
