export interface ProgramLike {
  location: {
    startRow: number;
    startCol: number;
    endRow: number;
    endCol: number;
  };
  comment?: comment;
  toString(): string;
}

export type ProgramList = Program & Program[];
export declare class Program extends ProgramLike {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(...args: any[]);
  location: {
    startRow: number;
    startCol: number;
    endRow: number;
    endCol: number;
  };
  comment?: comment;
  toString(): string;
}
export declare class comment extends Program {
  txt: string;
}
export declare class literal extends Program {
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
export declare class defFunc extends Program {
  name: symbolExpr;
  args: ProgramList;
  body: Program;
}
export declare class defVar extends Program {
  name: symbolExpr;
  expr: Program;
}
export declare class defVars extends Program {}
export declare class defStruct extends Program {
  name: symbolExpr;
  fields: ProgramList;
}
export declare class beginExpr extends Program {
  exprs: Program[];
}
export declare class lambdaExpr extends Program {
  args: ProgramList;
  body: Program;
}
export declare class localExpr extends Program {}
export declare class letrecExpr extends Program {
  bindings: ProgramList;
  body: Program;
  stx: symbolExpr[];
}
export declare class letExpr extends Program {
  bindings: ProgramList;
  body: Program;
  stx: symbolExpr[];
}
export declare class letStarExpr extends Program {
  bindings: ProgramList;
  body: Program;
  stx: symbolExpr[];
}
export declare class condExpr extends Program {
  clauses: Program[];
}
export declare class caseExpr extends Program {}
export declare class andExpr extends Program {
  exprs: Program[];
}
export declare class orExpr extends Program {
  exprs: Program[];
}
export declare class callExpr extends Program {
  func?: symbolExpr;
  args: (Program & { func?: symbolExpr })[];
}
export declare class ifExpr extends Program {
  predicate: Program;
  consequence: Program;
  alternative: Program;
}
export declare class whenUnlessExpr extends Program {
  predicate: Program;
  exprs: ProgramList;
  stx: { val: string };
}
export declare class symbolExpr extends Program {
  val: string;
}
export declare class quotedExpr extends Program {}
export declare class unquotedExpr extends Program {}
export declare class quasiquotedExpr extends Program {}
export declare class unquoteSplice extends Program {}
export declare class requireExpr extends Program {
  stx: Program;
  spec: symbolExpr;
}
export declare class provideStatement extends Program {}
export declare class unsupportedExpr extends Program {
  val: unknown[];
}
export declare class couple extends Program {
  first: symbolExpr;
  second: Program;
}
