export class Primitive {
  constructor(name, {argumentTypes, returnType}={}) {
    this.name = name,
    this.argumentTypes = argumentTypes || [];
    this.returnType = returnType;
  }

  static fromConfig(config) {
    return new Primitive(
      config.name,
      {
        argumentTypes: config.argumentTypes,
        returnType: config.returnType,
      }
    );
  }
}

export class PrimitiveGroup {
  constructor(name, primitives=[]) {
    this.name = name;
    this.primitives = primitives;
  }

  filter(search) {
    if (!search) {
      return this;
    }
    let result = [];
    for (let primitive of this.primitives) {
      if (primitive.name.indexOf(search) >= 0) {
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
    return new PrimitiveGroup(this.name, result);
  }

  static fromConfig(config) {
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
        items.push(new Primitive(item));
      } else if (typeof item == 'object') {
        if (item.primitives) {
          // it's a group
          items.push(PrimitiveGroup.fromConfig(item));
        } else {
          items.push(Primitive.fromConfig(item));
        }
      } else {
        throw new Error(`Unable to understand config object of type ${typeof item}`);
      }
    }
    return new PrimitiveGroup(name, items);
  }
}
