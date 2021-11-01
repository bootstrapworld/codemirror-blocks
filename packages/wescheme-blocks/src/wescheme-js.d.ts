declare module "wescheme-js/src/structures" {
  interface ProgramLike {
    location: {
      startRow: number;
      startCol: number;
      endRow: number;
      endCol: number;
    };
    comment?: comment;
    toString(): string;
  }

  type ProgramList = Program & Program[];
  declare class Program extends ProgramLike {
    location: {
      startRow: number;
      startCol: number;
      endRow: number;
      endCol: number;
    };
    comment?: comment;
    toString(): string;
  }
  export class comment extends Program {
    txt: string;
  }
  export class literal extends Program {
    val:
      | {
          val: unknown;
          isRational: undefined;
        }
      | {
          val: unknown;
          isRational: () => boolean;
          numerator: () => number;
          denominator: () => number;
        };
  }
  export class defFunc extends Program {
    name: symbolExpr;
    args: ProgramList;
    body: Program;
  }
  export class defVar extends Program {
    name: symbolExpr;
    expr: Program;
  }
  export class defVars extends Program {}
  export class defStruct extends Program {
    name: symbolExpr;
    fields: ProgramList;
  }
  export class beginExpr extends Program {
    exprs: Program[];
  }
  export class lambdaExpr extends Program {
    args: ProgramList;
    body: Program;
  }
  export class localExpr extends Program {}
  export class letrecExpr extends Program {
    bindings: ProgramList;
    body: Program;
    stx: symbolExpr[];
  }
  export class letExpr extends Program {
    bindings: ProgramList;
    body: Program;
    stx: symbolExpr[];
  }
  export class letStarExpr extends Program {
    bindings: ProgramList;
    body: Program;
    stx: symbolExpr[];
  }
  export class condExpr extends Program {
    clauses: Program[];
  }
  export class caseExpr extends Program {}
  export class andExpr extends Program {
    exprs: Program[];
  }
  export class orExpr extends Program {
    exprs: Program[];
  }
  export class callExpr extends Program {
    func?: symbolExpr;
    args: (Program & { func?: symbolExpr })[];
  }
  export class ifExpr extends Program {
    predicate: Program;
    consequence: Program;
    alternative: Program;
  }
  export class whenUnlessExpr extends Program {
    predicate: Program;
    exprs: ProgramList;
    stx: { val: string };
  }
  export class symbolExpr extends Program {
    val: string;
  }
  export class literal extends Program {}
  export class quotedExpr extends Program {}
  export class unquotedExpr extends Program {}
  export class quasiquotedExpr extends Program {}
  export class unquoteSplice extends Program {}
  export class requireExpr extends Program {
    stx: Program;
    spec: symbolExpr;
  }
  export class provideStatement extends Program {}
  export class unsupportedExpr extends Program {
    val: unknown[];
  }
  export class couple extends Program {
    first: symbolExpr;
    second: Program;
  }
}
