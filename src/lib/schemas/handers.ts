import { ReferenceObject, SchemaObject } from 'openapi3-ts';

export function typeHandler(
    schema: SchemaObject | ReferenceObject,
    prefix?: string
): string | undefined {
    if ((schema as ReferenceObject).$ref !== undefined) {
        let ref = (schema as ReferenceObject).$ref;
        if (prefix === undefined) return ref.split('/').pop();
        else {
            return prefix + '.' + ref.split('/').pop();
        }
    } else {
        let obj = schema as SchemaObject;
        switch (obj.type) {
            case 'string': {
                if (Array.isArray(obj.enum)) {
                    return obj.enum.map((e) => `'${e}'`).join(' | ');
                }
                if (obj.format === 'binary') {
                    return 'Blob';
                }
                return 'string';
            }
            case 'boolean': {
                return 'boolean';
            }
            case 'number':
            case 'integer': {
                if (Array.isArray(obj.enum)) {
                    return obj.enum.map((e) => `${e}`).join(' | ');
                }
                return 'number';
            }
            case 'array': {
                if (obj.items !== undefined) {
                    let type = typeHandler(obj.items, prefix);
                    if (type === undefined) type = 'any';
                    return `${type}[]`;
                }
                return 'any[]';
            }
            case 'object': {
                if (obj.properties !== undefined) {
                    let props = [];
                    for (let name in obj.properties) {
                        let prop = obj.properties[name];
                        let type = typeHandler(prop, prefix);
                        if (type === undefined) type = 'any';
                        let description = '';
                        let d = (prop as SchemaObject).description;
                        if (prop !== undefined && d !== undefined) {
                            description = d;
                        }
                        let nullable = true;
                        let n = (prop as SchemaObject).nullable;
                        if (n != undefined) {
                            nullable = n;
                        }
                        let t = ``;
                        if (description !== '') {
                            t += `/**
                            * @description ${description}
                            */`;
                        }
                        props.push(
                            t +
                                `
                        "${name}"${nullable ? '?' : ''}: ${type}`
                        );
                    }
                    return `{
${props.join('\n')}
}`;
                }
            }
        }
    }
}

export function enumHandler(
    name: string,
    schema: SchemaObject | ReferenceObject
): string | undefined {
    let obj = schema as SchemaObject;
    if (obj.enum === undefined) {
        return undefined;
    }
    if (obj.type === 'string') {
        return `export enum ${name} {
            ${obj.enum.map((e) => `${e} = '${e}',`).join('\n')}
        }`;
    } else if (obj.type === 'number' || obj.type === 'integer') {
        return `export type ${name} = ${typeHandler(schema)}`;
    }
    return undefined;
}

export function commonHandler(
    name: string,
    schema: SchemaObject | ReferenceObject
): string | undefined {
    let obj = schema as SchemaObject;
    if (
        obj.type === 'array' ||
        obj.type === 'string' ||
        obj.type === 'integer' ||
        obj.type === 'null' ||
        obj.type === 'boolean'
    ) {
        return `export type ${name} = ${typeHandler(schema)}`;
    }
    return undefined;
}

export function objectHandler(
    name: string,
    schema: SchemaObject | ReferenceObject
): string | undefined {
    let obj = schema as SchemaObject;
    if (obj.type !== 'object') {
        return undefined;
    }
    let properties = obj.properties;
    let paramsNames: string[] = [];
    let paramsType: Record<string, string> = {};
    let paramsTypeTemplate = [];
    let initTemplate = [];
    let defaultMap: Record<string, string | number> = {};
    let nullable: Record<string, boolean | undefined> = {};
    // resolve properties
    if (properties !== undefined) {
        paramsNames = Object.keys(properties);
        let descriptions: Record<string, string> = {};
        for (let paramName of paramsNames) {
            let param = properties[paramName];
            if (param !== undefined) {
                paramsType[paramName] = typeHandler(param) || 'any';
                let p = param as SchemaObject;
                if (p.description !== undefined) {
                    descriptions[paramName] = p.description;
                }
                if (p.nullable !== undefined) {
                    nullable[paramName] = p.nullable;
                }
                if (p.default !== undefined) {
                    if (typeof p.default === 'string') {
                        defaultMap[paramName] = `'${p.default}'`;
                    } else if (typeof p.default === 'number') {
                        defaultMap[paramName] = `${p.default}`;
                    } else if (typeof p.default === 'boolean') {
                        defaultMap[paramName] = `${p.default}`;
                    }
                }
            }
        }

        for (let i = 0; i < paramsNames.length; ++i) {
            let paramName = paramsNames[i];
            let t = ``;
            if (descriptions[paramName] !== undefined) {
                t += `/**
                * @description ${descriptions[paramName]}
                */
               `;
            }
            t += `${paramName}${nullable[paramName] === false ? '' : '?'}: ${
                paramsType[paramName]
            }`;
            paramsTypeTemplate.push(t);
        }

        for (let i = 0; i < paramsNames.length; ++i) {
            let paramName = paramsNames[i];
            initTemplate.push(`this.${paramName} = ${paramName}`);
        }
    }

    let template = `    
export class ${name} {
        ${paramsTypeTemplate.join(';\n')}

        constructor({
            ${paramsNames
                .map((e) => {
                    if (defaultMap[e] !== undefined) {
                        return `${e} = ${defaultMap[e]}`;
                    }
                    return e;
                })
                .join(',\n')}
        }:{
            ${paramsTypeTemplate.join(',\n')}
        }){
            ${initTemplate.join(';\n')}
        }
    }
    `;
    return template;
}
