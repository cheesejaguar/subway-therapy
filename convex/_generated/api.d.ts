/* eslint-disable */
/**
 * Generated API stub - will be replaced by Convex codegen
 */

import type { FunctionReference } from "convex/server";

export declare const api: {
  notes: {
    getApprovedNotes: FunctionReference<"query", "public", Record<string, never>, unknown[]>;
    getNotesInViewport: FunctionReference<
      "query",
      "public",
      { minX: number; maxX: number; minY: number; maxY: number },
      unknown[]
    >;
    getNotesForModeration: FunctionReference<
      "query",
      "public",
      { status?: string },
      unknown[]
    >;
    getNoteByVisibleId: FunctionReference<
      "query",
      "public",
      { visibleId: string },
      unknown | null
    >;
    getStats: FunctionReference<
      "query",
      "public",
      Record<string, never>,
      { total: number; pending: number; approved: number; rejected: number; flagged: number }
    >;
    createNote: FunctionReference<
      "mutation",
      "public",
      {
        visibleId: string;
        imageUrl: string;
        color: string;
        x: number;
        y: number;
        rotation: number;
        createdAt: string;
        moderationStatus: string;
        flagCount: number;
        sessionId: string;
      },
      string
    >;
    moderateNote: FunctionReference<
      "mutation",
      "public",
      { visibleId: string; status: string },
      { success: boolean } | null
    >;
    flagNote: FunctionReference<
      "mutation",
      "public",
      { visibleId: string },
      { flagCount: number } | null
    >;
    deleteNote: FunctionReference<
      "mutation",
      "public",
      { visibleId: string },
      { success: boolean; imageUrl?: string }
    >;
  };
};
