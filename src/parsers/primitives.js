export class Primitive {
  constructor(parser, name, {argumentTypes, returnType}={}) {
    this.parser = parser;
    this.name = name;
    this.argumentTypes = argumentTypes || [];
    this.returnType = returnType;
  }

  getASTNode() {
    if (this.parser.getASTNodeForPrimitive) {
      return this.parser.getASTNodeForPrimitive(this);
    }
  }

  getLiteralNode() {
    if (this.parser.getLiteralNodeForPrimitive) {
      return this.parser.getLiteralNodeForPrimitive(this);
    }
  }

  static fromConfig(parser, config) {
    return new Primitive(
      parser,
      config.name,
      {
        argumentTypes: config.argumentTypes,
        returnType: config.returnType,
      }
    );
  }
}

export class PrimitiveGroup {
  constructor(parser, name, primitives) {
    this.parser = parser;
    this.name = name;
    this.primitives = primitives;
  }

  filter(search) {
    if (!search) {
      return this;
    }
    let result = [];
    for (let primitive of this.primitives) {
      if (primitive.name.toLowerCase().indexOf(search.toLowerCase()) >= 0) {
        // let's display the entire group and/or primitive
        result.push(primitive);
      } else if (primitive instanceof PrimitiveGroup) {
        // it's a group with a name that doesn't match
        // let's see if child primitives/groups match
        let filtered = primitive.filter(search);
        if (filtered.primitives.length > 0) {
          result.push(filtered);
        }
      }
    }
    return new PrimitiveGroup(this.parser, this.name, result);
  }

  static fromConfig(parser, config) {
    var {name, primitives} = config;
    if (!name) {
      throw new Error('No name specified for primitive group');
    }
    if (!primitives) {
      console.warn(`primitive group "${name}" doesn't have any primitives`);
      primitives = [];
    }
    const items = [];
    for (let item of primitives) {
      if (typeof item == 'string') {
        items.push(new Primitive(parser, item));
      } else if (typeof item == 'object') {
        if (item.primitives) {
          // it's a group
          items.push(PrimitiveGroup.fromConfig(parser, item));
        } else {
          items.push(Primitive.fromConfig(parser, item));
        }
      } else {
        throw new Error(`Unable to understand config object of type ${typeof item}`);
      }
    }
    return new PrimitiveGroup(parser, name, items);
  }
}
