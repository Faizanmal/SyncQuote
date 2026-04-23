declare module 'diff' {
  export interface Change {
    count?: number;
    added?: boolean;
    removed?: boolean;
    value: string;
  }

  export function diffChars(oldStr: string, newStr: string): Change[];
  export function diffWords(oldStr: string, newStr: string): Change[];
  export function diffWordsWithSpace(oldStr: string, newStr: string): Change[];
  export function diffLines(oldStr: string, newStr: string): Change[];
  export function diffTrimmedLines(oldStr: string, newStr: string): Change[];
  export function diffSentences(oldStr: string, newStr: string): Change[];
  export function diffCss(oldStr: string, newStr: string): Change[];
  export function diffJson(oldObj: any, newObj: any): Change[];
  export function diffArrays(oldArr: any[], newArr: any[]): Change[];
}