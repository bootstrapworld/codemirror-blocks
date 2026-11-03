import {buildParser} from '@lezer/generator'
import {LRLanguage} from '@codemirror/language'
export const parser = buildParser(`
@top Program { expr* }
expr { List | Atom | String }
List { "(" expr* ")" }
@skip { space | Comment }
@tokens {
  Atom { ![ \\t\\n();"]+ }
  String { '"' (!["\\\\] | "\\\\" _)* '"' }
  Comment { ";" ![\\n]* }
  space { $[ \\t\\n]+ }
  "(" ")"
}`)
export const lang = LRLanguage.define({parser})
