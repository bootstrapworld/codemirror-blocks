// give (a,b), produce -1 if a<b, +1 if a>b, and 0 if a=b
export function poscmp(a, b) { return  a.line - b.line || a.ch - b.ch;  }
