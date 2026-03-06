// ─────────────────────────────────────────────────────────────────────────────
// GENERATED FILE — do not edit manually.
// Source: canonical-model.yaml v1.1.0
// Generator: codegen.js
// Regenerate: node codegen.js example.canonical-model.yaml
// ─────────────────────────────────────────────────────────────────────────────

// operation:    delete-order
// method:       DELETE /orders/{orderId}
// intentRef:    —
// ruleRefs:     []
// scenarioRefs: []
//
// IMPLEMENT THIS STUB in: src/operations/delete-order.ts
// Do not modify this file. Changes here will be overwritten by codegen.


export type DeleteOrderRequest = {
  pathParams: { orderId: string };
};

export type DeleteOrderFn = (request: DeleteOrderRequest) => void;
