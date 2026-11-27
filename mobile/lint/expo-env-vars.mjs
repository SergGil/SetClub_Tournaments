// oxlint JS plugin: the two process.env rules from eslint-plugin-expo (MIT,
// https://github.com/expo/expo/tree/main/packages/eslint-plugin-expo), ported without its
// @typescript-eslint/utils dependency - that package pins typescript <6.1, which would block
// TypeScript 7 here. Same AST checks and messages as eslint-plugin-expo 1.2.1.
//
// Why they matter: Expo inlines EXPO_PUBLIC_* variables at build time only for static
// `process.env.EXPO_PUBLIC_X` reads. Dynamic or destructured reads are left as-is and are
// `undefined` in a production bundle.

/** `process.env` as a MemberExpression node. */
function isProcessEnv(node) {
  return (
    node?.type === "MemberExpression" &&
    node.object.type === "Identifier" &&
    node.object.name === "process" &&
    node.property.type === "Identifier" &&
    node.property.name === "env"
  );
}

const noDynamicEnvVar = {
  meta: {
    type: "problem",
    docs: { description: "Prevents process.env from being accessed dynamically" },
    schema: [],
    messages: {
      unexpectedDynamicAccess: "Unexpected dynamic access. Cannot dynamically access {{value}} from process.env",
    },
  },
  create(context) {
    return {
      VariableDeclarator(node) {
        const init = node.init;
        if (init?.type !== "MemberExpression" || !init.computed || !isProcessEnv(init.object)) return;
        const property = init.property;
        const value = property.type === "Identifier" ? property.name : property.type === "Literal" ? property.value : "";
        context.report({ node, messageId: "unexpectedDynamicAccess", data: { value: String(value) } });
      },
    };
  },
};

const noEnvVarDestructuring = {
  meta: {
    type: "problem",
    docs: { description: "Disallow destructuring of environment variables" },
    schema: [],
    messages: {
      unexpectedDestructuring: "Unexpected destructuring. Cannot destructure {{value}} from process.env",
    },
  },
  create(context) {
    return {
      VariableDeclarator(node) {
        if (node.id.type !== "ObjectPattern" || !isProcessEnv(node.init)) return;
        for (const property of node.id.properties) {
          const value = property.value?.type === "Identifier" ? property.value.name : "variables";
          context.report({ node, messageId: "unexpectedDestructuring", data: { value } });
        }
      },
    };
  },
};

export default {
  meta: { name: "expo-env-vars" },
  rules: {
    "no-dynamic-env-var": noDynamicEnvVar,
    "no-env-var-destructuring": noEnvVarDestructuring,
  },
};
