// `structuredClone` exists in every runtime this package runs in (Node 17+ and modern
// browsers), but the library tsconfig loads neither the DOM lib nor @types/node.
declare function structuredClone<T>(value: T): T;
