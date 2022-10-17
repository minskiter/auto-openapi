import { ReferenceObject, SchemaObject } from 'openapi3-ts';

function typeHandler(
    schema: SchemaObject | ReferenceObject
): string | undefined {
    if ((schema as ReferenceObject).$ref !== undefined) {
        let ref = (schema as ReferenceObject).$ref;
        return ref.split('/').pop();
    } else {
        let obj = schema as SchemaObject;
        switch (obj.type) {
            case 'string': {
                if (Array.isArray(obj.enum)) {
                    return obj.enum.map((e) => `'${e}'`).join(' | ');
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
                    let type = typeHandler(obj.items);
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
                        let type = typeHandler(prop);
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
                        ${name}${n ? '?' : ''}: ${type}`
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

export function objectHandler(
    name: string,
    schema: SchemaObject | ReferenceObject
): string | undefined {
    if ((schema as SchemaObject).type !== 'object') {
        return undefined;
    }
    let properties = (schema as SchemaObject).properties;
    let paramsNames: string[] = [];
    let paramsType: Record<string, string> = {};
    let paramsTypeTemplate = [];
    let initTemplate = [];
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
            ${paramsNames.join(',\n')}
        }:{
            ${paramsTypeTemplate.join(',\n')}
        }){
            ${initTemplate.join(';\n')}
        }
    }

    `;
    return template;
}
