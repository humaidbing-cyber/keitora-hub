import type { snapshot } from "@/lib/service";
import type { reports } from "@/lib/reports";
type Wire<T> = T extends bigint
  ? string
  : T extends Date
    ? string
    : T extends Array<infer U>
      ? Wire<U>[]
      : T extends object
        ? { [K in keyof T]: Wire<T[K]> }
        : T;
export type Data = Wire<Awaited<ReturnType<typeof snapshot>>> & {
  report: Wire<ReturnType<typeof reports>>;
};
export type Row = Record<string, unknown>;
