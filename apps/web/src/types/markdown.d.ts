// Markdown files import as their text (raw-loader, next.config.ts).
declare module '*.md' {
  const text: string;
  export default text;
}
