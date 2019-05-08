import {getLanguage} from '../languages';

export class Primitive {
  constructor(languageId, name, {argumentTypes, returnType}={}) {
    this.languageId = languageId;
    this.parser = languageId ? getLanguage(languageId).getParser() : null;
    this.name = name;
    this.argumentTypes = argumentTypes || [];
    this.returnType = returnType;
  }

  toString() {
    return this.name;
  }

  getASTNode() {
    if (this.parser && this.parser.getASTNodeForPrimitive) {
      return this.parser.getASTNodeForPrimitive(this);
    }
  }

  getLiteralNode() {
    if (this.parser && this.parser.getLiteralNodeForPrimitive) {
      return this.parser.getLiteralNodeForPrimitive(this);
    }
  }

  static fromConfig(languageId, config) {
    return new Primitive(
      languageId,
      config.name,
      {
        argumentTypes: config.argumentTypes,
        returnType: config.returnType,
      }
    );
  }
}

export class PrimitiveGroup {
  constructor(languageId, name, primitives) {
    this.languageId = languageId;
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
    return new PrimitiveGroup(this.languageId, this.name, result);
  }

  static fromConfig(languageId, config) {
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
        items.push(new Primitive(languageId, item));
      } else if (typeof item == 'object') {
        if (item.primitives) {
          // it's a group
          items.push(PrimitiveGroup.fromConfig(languageId, item));
        } else {
          items.push(Primitive.fromConfig(languageId, item));
        }
      } else {
        throw new Error(`Unable to understand config object of type ${typeof item}`);
      }
    }
    return new PrimitiveGroup(languageId, name, items);
  }
}
