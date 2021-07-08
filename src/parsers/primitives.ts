import {getLanguage} from '../languages';
import type {Language} from '../CodeMirrorBlocks';

export class Primitive {
  languageId: string;
  name: string;
  parse: Language['parse'];
  primitivesFn: Language['primitivesFn'];
  primitives: Language['primitives'];
  getASTNodeForPrimitive: Language['getASTNodeForPrimitive'];
  getLiteralNodeForPrimitive: Language['getLiteralNodeForPrimitive'];
  argumentTypes: string[];
  returnType: string;

  constructor(languageId: string, name: string, config: {argumentTypes?: string[], returnType?: string} = {}) {
    this.languageId = languageId;
    this.parse = languageId ? getLanguage(languageId).parse : null;
    this.primitives = languageId ? getLanguage(languageId).primitives : null;
    this.primitivesFn = languageId ? getLanguage(languageId).primitivesFn : null;
    this.getASTNodeForPrimitive = languageId ? getLanguage(languageId).getASTNodeForPrimitive : null;
    this.getLiteralNodeForPrimitive = languageId ? getLanguage(languageId).getLiteralNodeForPrimitive : null;
    this.name = name;
    this.argumentTypes = config.argumentTypes || [];
    this.returnType = config.returnType;
  }

  toString() {
    return this.name;
  }

  getASTNode() {
    if (this.getASTNodeForPrimitive) {
      return this.getASTNodeForPrimitive(this);
    }
  }

  getLiteralNode() {
    if (this.getLiteralNodeForPrimitive) {
      return this.getLiteralNodeForPrimitive(this);
    }
  }

  static fromConfig(languageId: string, config: PrimitiveConfig) {
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

type PrimitiveConfig = {
  name: string;
  argumentTypes: string[];
  returnType: string;
  primitives: undefined;
}

type PrimitiveGroupConfig = {
  name: string;
  primitives: (string|PrimitiveGroupConfig|PrimitiveConfig)[];
}

export class PrimitiveGroup {
  languageId: string;
  name: string;
  primitives: (Primitive|PrimitiveGroup)[]
  constructor(languageId: string, name: string, primitives: (Primitive|PrimitiveGroup)[]) {
    this.languageId = languageId;
    this.name = name;
    this.primitives = primitives;
  }

  filter(search: string) {
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

  static fromConfig(languageId: string, config: PrimitiveGroupConfig) {
    var {name, primitives} = config;
    if (!name) {
      throw new Error('No name specified for primitive group');
    }
    if (!primitives) {
      console.warn(`primitive group "${name}" doesn't have any primitives`);
      primitives = [];
    }
    const items: (Primitive|PrimitiveGroup)[] = [];
    for (let item of primitives) {
      if (typeof item == 'string') {
        items.push(new Primitive(languageId, item));
      } else if (typeof item == 'object') {
        if (item.primitives) {
          // it's a group
          items.push(PrimitiveGroup.fromConfig(languageId, item));
        } else {
          items.push(Primitive.fromConfig(languageId, item as PrimitiveConfig));
        }
      } else {
        throw new Error(`Unable to understand config object of type ${typeof item}`);
      }
    }
    return new PrimitiveGroup(languageId, name, items);
  }
}
