/* tslint:disable:no-console */
import { API, FileInfo } from 'jscodeshift/src/core';
import * as path from 'path';
import { parseLess } from './less-parser';
import { DynamicRulesAggregator, IDynamicRulesetsMap } from './dynamic-rules-aggregator';
import { ITokenizedDynamicRulesMap, tokenize } from './rules-tokenizer';
import { Identifier, ImportDeclaration } from 'ast-types/gen/nodes';

let DRA_ID = 0;
const ROOT_PATH = process.cwd();
const TO_SOURCE_OPTIONS: any = { quote: 'single' };
const THEME_MANAGER_PATH = path.join('..', 'retail-ui', 'lib', 'ThemeManager');

function extractDynamicClasses(fileInfo: FileInfo, api: API) {
  const j = api.jscodeshift;
  const root = j(fileInfo.source);

  const parsedLess = new Map<string, IDynamicRulesetsMap>();
  const stylesMap = new Map<Identifier, IDynamicRulesetsMap>();

  let importDeclarations = root.find(j.ImportDeclaration);

  // replace "classnames" imports with {classnames} from 'emotion'
  let emotionImportStatement: ImportDeclaration | null = null;
  let emotionCxImportIdentifier: Identifier | null = null;
  const classnamesImports = importDeclarations.filter(
    ({ node }) => !!node && !!node.source && !!node.source.value && node.source.value === 'classnames',
  );
  if (classnamesImports.length === 1) {
    const classnamesImport: ImportDeclaration = classnamesImports.get().value;

    const specifier = classnamesImport && classnamesImport.specifiers[0] && classnamesImport.specifiers[0];
    if (specifier && specifier.type === 'ImportDefaultSpecifier') {
      const classnamesImportName = (specifier.local && specifier.local.name) || '';
      if (classnamesImportName) {
        emotionCxImportIdentifier = j.identifier(classnamesImportName);
        emotionImportStatement = j.importDeclaration(
          [j.importSpecifier(j.identifier('cx'), emotionCxImportIdentifier)],
          j.literal('emotion'),
        );
        classnamesImports.remove();
      }
    }
  } else if (classnamesImports.length > 1) {
    console.warn('There are multiple "classnames" imports, possibly a bug');
  }

  /*find all less imports .less*/
  importDeclarations
    .filter(
      ({ node }) =>
        !!node && !!node.source && typeof node.source.value === 'string' && node.source.value.endsWith('.less'),
    )
    .forEach(importNodePath => {
      const node = importNodePath.value;

      if (node.specifiers && node.specifiers.length > 0) {
        if (node.specifiers.length > 1) {
          throw new Error('Multiple specifiers for style import!');
        }
        const specifier = node.specifiers[0].local as Identifier;
        if (specifier && !stylesMap.has(specifier)) {
          const lessFilePath = path.resolve(ROOT_PATH, path.dirname(fileInfo.path), node.source.value as string);
          if (!parsedLess.has(lessFilePath)) {
            const dynamicRulesAggregator = new DynamicRulesAggregator(DRA_ID++);
            // NOTE: we use dynamicRulesAggregator in the way we'd use 'out' in C#
            parseLess(lessFilePath, dynamicRulesAggregator);
            parsedLess.set(lessFilePath, dynamicRulesAggregator.getRulesets());
          }
          stylesMap.set(specifier, parsedLess.get(lessFilePath)!);
        }
      }
    });

  root.find(j.CallExpression, { callee: { name: 'require' } }).forEach(requireStatement => {
    if (requireStatement.parent.value && requireStatement.parent.value.type === 'ConditionalExpression') {
      if (requireStatement.parent.parent && requireStatement.parent.parent.parent) {
        const declaration = requireStatement.parent.parent.parent.value;
        if (declaration.declarations && declaration.declarations.length > 0) {
          if (declaration.declarations.length > 1) {
            throw new Error('Multiple declarations for styles require!');
          }
        }

        const lessFile = (requireStatement.value.arguments[0] as any).value as string;
        if (lessFile.endsWith('.less') && !lessFile.endsWith('.flat.less')) {
          const styleNode = declaration.declarations[0].id;
          if (styleNode && !stylesMap.has(styleNode)) {
            const lessFilePath = path.resolve(ROOT_PATH, path.dirname(fileInfo.path), lessFile);
            if (!parsedLess.has(lessFilePath)) {
              const dynamicRulesAggregator = new DynamicRulesAggregator(DRA_ID++);
              // NOTE: we use dynamicRulesAggregator in the way we'd use 'out' in C#
              parseLess(lessFilePath, dynamicRulesAggregator);
              parsedLess.set(lessFilePath, dynamicRulesAggregator.getRulesets());
            }
            stylesMap.set(styleNode, parsedLess.get(lessFilePath)!);
          }
        }
      }
    } else if (requireStatement.parent.value && requireStatement.parent.value.type === 'VariableDeclarator') {
      const declaration = requireStatement.parent.parent.value;
      if (declaration.declarations && declaration.declarations.length > 0) {
        if (declaration.declarations.length > 1) {
          throw new Error('Multiple declarations for styles require!');
        }
      }
      const lessFile = (requireStatement.value.arguments[0] as any).value as string;
      if (lessFile.endsWith('.less') && !lessFile.endsWith('.flat.less')) {
        const styleNode = declaration.declarations[0].id;
        if (styleNode && !stylesMap.has(styleNode)) {
          const lessFilePath = path.resolve(ROOT_PATH, path.dirname(fileInfo.path), lessFile);
          if (!parsedLess.has(lessFilePath)) {
            const dynamicRulesAggregator = new DynamicRulesAggregator(DRA_ID++);
            // NOTE: we use dynamicRulesAggregator in the way we'd use 'out' in C#
            parseLess(lessFilePath, dynamicRulesAggregator);
            parsedLess.set(lessFilePath, dynamicRulesAggregator.getRulesets());
          }
          stylesMap.set(styleNode, parsedLess.get(lessFilePath)!);
        }
      }
    }
  });

  if (!stylesMap.size) {
    return root.toSource();
  }

  const tokenizedStylesMap: Map<Identifier, ITokenizedDynamicRulesMap> = new Map();

  stylesMap.forEach((styles, identifier) => {
    tokenizedStylesMap.set(identifier, tokenize(styles));
  });

  let emotionCssImportIdentifier: Identifier | null = null;
  if (tokenizedStylesMap.size > 0) {
    // as we have dynamic rules, we need to import css from 'emotion'
    emotionCssImportIdentifier = j.identifier('css');
    if (emotionImportStatement) {
      // already have classnames
      emotionImportStatement.specifiers.unshift(j.importSpecifier(emotionCssImportIdentifier));
    } else {
      emotionImportStatement = j.importDeclaration(
        [j.importSpecifier(emotionCssImportIdentifier)],
        j.literal('emotion'),
      );
    }
  }

  // has no dynamic styles, skip
  if (!emotionImportStatement) {
    return root.toSource(TO_SOURCE_OPTIONS);
  }

  // add css/cx imports
  importDeclarations = root.find(j.ImportDeclaration);
  importDeclarations.at(importDeclarations.length - 1).insertAfter(emotionImportStatement);

  const themeManagerIdentifier = j.identifier('ThemeManager');
  const dynamicStylesTypeIdentifier = j.identifier('DynamicStylesType');
  const themeManagerImportPath = path.relative(path.dirname(fileInfo.path), THEME_MANAGER_PATH).replace(/\\/g, '/');
  const themeManagerImportStatement = j.importDeclaration(
    [j.importDefaultSpecifier(themeManagerIdentifier), j.importSpecifier(dynamicStylesTypeIdentifier)],
    j.literal(themeManagerImportPath),
  );

  importDeclarations = root.find(j.ImportDeclaration);
  importDeclarations.at(importDeclarations.length - 1).insertAfter(themeManagerImportStatement);

  const themeIdentifier = j.identifier('defaultTheme');
  const themeConst = j.variableDeclaration('const', [
    j.variableDeclarator(
      themeIdentifier,
      j.callExpression(j.memberExpression(themeManagerIdentifier, j.identifier('getVariables')), []),
    ),
  ]);

  const stylesIdentifiers = Array.from(stylesMap.keys());

  tokenizedStylesMap.forEach((styles, identifier) => {
    const objectProperties: any[] = [];
    const dynamicStyleArgumentIdentifier = j.identifier('theme');
    const dynamicStylesIdentifier = j.identifier(`${identifier.name}Dynamic`);

    styles.forEach((ruleset, className) => {
      const templateLiteralQuasis: any[] = [];
      const templateLiteralExpressions: any[] = [];

      const ownRules = Object.keys(ruleset.rules);
      const cascades = ruleset.cascade;
      let quasi = '';
      for (const ruleName of ownRules) {
        quasi = `${'\n\t\t\t'}${ruleName}: `;
        const ruleParts = ruleset.rules[ruleName];
        ruleParts.forEach(value => {
          if (value.startsWith(':variable')) {
            templateLiteralQuasis.push(
              j.templateElement(
                {
                  cooked: quasi,
                  raw: quasi,
                },
                false,
              ),
            );
            const variableName = value.replace(':variable(', '').replace(')', '');
            templateLiteralExpressions.push(
              j.memberExpression(dynamicStyleArgumentIdentifier, j.identifier(variableName)),
            );
            quasi = '';
          } else {
            quasi = quasi + value;
          }
        });
        quasi = quasi + ';';
      }

      if (ownRules.length > 0 && cascades.size > 0) {
        quasi = quasi + '\n';
      }

      cascades.forEach((cascadeRulesObject, cascadeNameParts) => {
        quasi = quasi + '\n\t\t\t';
        cascadeNameParts.forEach(cascadeNamePart => {
          if (cascadeNamePart.startsWith(':static')) {
            templateLiteralQuasis.push(
              j.templateElement(
                {
                  cooked: quasi,
                  raw: quasi,
                },
                false,
              ),
            );
            quasi = '';
            const variableName = cascadeNamePart.replace(':static(', '').replace(')', '');
            templateLiteralExpressions.push(j.memberExpression(identifier, j.identifier(variableName)));
          } else if (cascadeNamePart.startsWith(':dynamic')) {
            templateLiteralQuasis.push(
              j.templateElement(
                {
                  cooked: quasi,
                  raw: quasi,
                },
                false,
              ),
            );
            quasi = '';
            const variableName = cascadeNamePart.replace(':dynamic(', '').replace(')', '');
            templateLiteralExpressions.push(
              j.callExpression(j.memberExpression(dynamicStylesIdentifier, j.identifier(variableName)), [
                dynamicStyleArgumentIdentifier,
              ]),
            );
          } else if (cascadeNamePart.startsWith(':global')) {
            const globalSelector = cascadeNamePart.replace(':global(', '').replace(')', '');
            quasi = quasi + globalSelector;
          } else {
            quasi = quasi + cascadeNamePart;
          }
        });

        quasi = quasi + ' {';

        const cascadeRules = Object.keys(cascadeRulesObject);
        for (let i = 0; i < cascadeRules.length; i++) {
          const ruleName = cascadeRules[i];
          quasi = quasi + `${'\n\t\t\t\t'}${ruleName}: `;
          const ruleParts = cascadeRulesObject[ruleName];
          ruleParts.forEach(value => {
            if (value.startsWith(':variable')) {
              templateLiteralQuasis.push(
                j.templateElement(
                  {
                    cooked: quasi,
                    raw: quasi,
                  },
                  false,
                ),
              );
              const variableName = value.replace(':variable(', '').replace(')', '');
              templateLiteralExpressions.push(
                j.memberExpression(dynamicStyleArgumentIdentifier, j.identifier(variableName)),
              );
              quasi = '';
            } else {
              quasi = quasi + value;
            }
          });

          quasi = quasi + ';';

          if (i === cascadeRules.length - 1) {
            quasi = quasi + '\n\t\t\t}';
          }
        }
      });

      templateLiteralQuasis.push(
        j.templateElement(
          {
            cooked: `${quasi}\n\t\t`,
            raw: `${quasi}\n\t\t`,
          },
          true,
        ),
      );

      const property = j.property(
        'init',
        j.identifier(className),
        j.functionExpression(
          null,
          [dynamicStyleArgumentIdentifier],
          j.blockStatement([
            j.returnStatement(
              j.taggedTemplateExpression(
                emotionCssImportIdentifier!,
                j.templateLiteral(templateLiteralQuasis, templateLiteralExpressions),
              ),
            ),
          ]),
        ),
      );
      property.method = true;
      objectProperties.push(property);
    });

    const objectExpression = j.objectExpression(objectProperties);
    const dynamicStylesIdentifierWithType = j.identifier(`${identifier.name}Dynamic`);
    dynamicStylesIdentifierWithType.typeAnnotation = j.tsTypeAnnotation(j.tsTypeReference(dynamicStylesTypeIdentifier));
    const dynamicStylesConst = j.variableDeclaration('const', [
      j.variableDeclarator(dynamicStylesIdentifierWithType, objectExpression),
    ]);

    let positionsToInsert: any = root.find(
      j.VariableDeclaration,
      node =>
        node.declarations &&
        (node.declarations[0].id === themeIdentifier || stylesIdentifiers.includes(node.declarations[0].id)),
    );

    if(positionsToInsert.length === 0) {
      positionsToInsert = root.find(j.ImportDeclaration);
    }

    positionsToInsert
      .at(positionsToInsert.length - 1)
      .insertAfter(dynamicStylesConst)
      .insertAfter(themeConst);
  });

  stylesIdentifiers.forEach(styleIdentifier => {
    const dynamicCounterpart = tokenizedStylesMap.get(styleIdentifier)!;
    const propertyNames = Array.from(dynamicCounterpart.keys()).map(k => k.replace('.', ''));
    root
      .find(j.MemberExpression, {
        object: {
          type: 'Identifier',
          name: styleIdentifier.name,
        },
        property: {
          type: 'Identifier',
        },
      })
      .filter(
        node => node.value && node.value.property && propertyNames.includes((node.value.property as Identifier).name),
      )
      .forEach(val => {
        const className = (val.value.property as Identifier).name;
        const dynamicRuleset = dynamicCounterpart.get(className)!;
        console.count(`${dynamicRuleset.isPartial}`);
        val.replace(j.callExpression(
          j.memberExpression(
            j.identifier(`${styleIdentifier.name}Dynamic`),
            j.identifier(className)
          ),
          [themeIdentifier]
        ))
      });
  });

  const result = root.toSource(TO_SOURCE_OPTIONS);

  // console.log('[extract-dynamic-classes.ts]', 'extractDynamicClasses', '\n', result);

  return result;
}

module.exports = extractDynamicClasses;