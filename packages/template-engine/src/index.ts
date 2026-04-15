// FILE: packages/template-engine/src/index.ts
// VERSION: 0.2.0
// START_MODULE_CONTRACT
//   PURPOSE: Barrel re-export of template engine: tokenizer, parser, renderer, filters, variable resolvers
//   SCOPE: All public exports of the template engine package
//   DEPENDS: M-SHARED-TYPES
//   LINKS: M-TEMPLATE-ENGINE
//   ROLE: BARREL
//   MAP_MODE: SUMMARY
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
//   Re-exports: tokenize, parse, render, renderAST, renderTemplate, applyFilterDirect, applyFilters,
//   buildVariables, addSchemaOrgDataToVariables, generateFrontmatter, formatPropertyValue,
//   resolveVariable, resolveVariableAsync, getNestedValue, valueToString, setMessageSender, setSelectorSender
// END_MODULE_MAP

export { tokenize, formatToken, formatError } from './tokenizer';
export type { TokenType, Token, TokenizerError, TokenizerResult } from './tokenizer';

export {
	parse,
	parseTokens,
	formatAST,
	validateVariables,
	validateFilters,
} from './parser';
export type {
	BaseNode,
	TextNode,
	VariableNode,
	IfNode,
	ForNode,
	SetNode,
	ASTNode,
	LiteralExpression,
	IdentifierExpression,
	BinaryExpression,
	UnaryExpression,
	FilterExpression,
	MemberExpression,
	GroupExpression,
	Expression,
	ParserError,
	ParserResult,
} from './parser';

export { render, renderAST, renderTemplate, createSelectorResolver } from './renderer';
export type {
	AsyncResolver,
	RenderContext,
	RenderOptions,
	RenderResult,
	RenderError,
} from './renderer';

export { applyFilterDirect, applyFilters } from './filters';
export { buildVariables, addSchemaOrgDataToVariables, generateFrontmatter, formatPropertyValue } from './shared';
export { resolveVariable, resolveVariableAsync, getNestedValue, valueToString } from './resolver';
export type { ResolverContext, SendMessageFn } from './resolver';

export { setMessageSender } from './resolver';
export { setSelectorSender } from './variables/selector';
