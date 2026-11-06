// Types for the Jest matchers that `expo-router/testing-library` registers at runtime.
// SDK 57 ships the matchers without type declarations.
declare global {
  namespace jest {
    interface Matchers<R> {
      toHavePathname(pathname: string): R;
      toHavePathnameWithParams(pathnameWithParams: string): R;
      toHaveSegments(segments: string[]): R;
      toHaveSearchParams(params: Record<string, string | string[]>): R;
      toHaveRouterState(state: object): R;
    }
  }
}

export {};
