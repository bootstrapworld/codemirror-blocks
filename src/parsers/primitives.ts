import { getLanguage } from "../languages";
import type { Language } from "../CodeMirrorBlocks";

export class Primitive {
  languageId: string;
  language: Language;
  name: string;
  argumentTypes: string[];
  returnType?: string;

  // used by Toolbar
  element?: HTMLElement | null;

  constructor(
    languageId: string,
    name: string,
    config: { argumentTypes?: string[]; returnType?: string } = {}
  ) {
    this.languageId = languageId;
    this.language = getLanguage(languageId);

    this.name = name;
    this.argumentTypes = config.argumentTypes || [];
    this.returnType = config.returnType;
  }

  toString() {
    return this.name;
  }

  getASTNode() {
    if (this.language.getASTNodeForPrimitive) {
      return this.language.getASTNodeForPrimitive(this);
    }
  }

  getLiteralNode() {
    if (this.language.getLiteralNodeForPrimitive) {
      return this.language.getLiteralNodeForPrimitive(this);
    }
  }

  static fromConfig(languageId: string, config: PrimitiveConfig) {
    return new Primitive(languageId, config.name, {
      argumentTypes: config.argumentTypes,
      returnType: config.returnType,
    });
  }
}

type PrimitiveConfig = {
  name: string;
  argumentTypes: string[];
  returnType: string;
  primitives?: undefined;
};

type PrimitiveGroupConfig = {
  name: string;
  primitives: (string | PrimitiveGroupConfig | PrimitiveConfig)[];
};

export class PrimitiveGroup {
  languageId: string;
  name: string;
  primitives: (Primitive | PrimitiveGroup)[];

  // used by Toolbar
  element?: HTMLElement;

  constructor(
    languageId: string,
    name: string,
    primitives: (Primitive | PrimitiveGroup)[]
  ) {
    this.languageId = languageId;
    this.name = name;
    this.primitives = primitives;
  }

  /**
   * An iterator over the leaf nodes for the
   * primitive group hierarchy that only yields
   * instances of Primitive. Traverses left to right.
   */
  *flatPrimitivesIter(): Generator<Primitive> {
    for (const primitive of this.primitives) {
      if (primitive instanceof Primitive) {
        yield primitive;
      } else {
        yield* primitive.flatPrimitivesIter();
      }
    }
  }

  filter(search: string): PrimitiveGroup {
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
    var { name, primitives } = config;
    if (!name) {
      throw new Error("No name specified for primitive group");
    }
    if (!primitives) {
      console.warn(`primitive group "${name}" doesn't have any primitives`);
      primitives = [];
    }
    const items: (Primitive | PrimitiveGroup)[] = [];
    for (let item of primitives) {
      if (typeof item == "string") {
        items.push(new Primitive(languageId, item));
      } else if (typeof item == "object") {
        if (item.primitives) {
          // it's a group
          items.push(
            PrimitiveGroup.fromConfig(languageId, item as PrimitiveGroupConfig)
          );
        } else {
          items.push(Primitive.fromConfig(languageId, item as PrimitiveConfig));
        }
      } else {
        throw new Error(
          `Unable to understand config object of type ${typeof item}`
        );
      }
    }
    return new PrimitiveGroup(languageId, name, items);
  }
}
