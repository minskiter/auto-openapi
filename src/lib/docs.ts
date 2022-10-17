import { OpenAPIObject, ReferenceObject, SchemaObject } from 'openapi3-ts';
import { objectHandler } from './schemas/handers';
import prettier from 'prettier';

export type SchamesHander = (
    name: string,
    schema: SchemaObject | ReferenceObject
) => string | undefined;

export class SchamesHanders {
    private _schemas: { [schema: string]: SchemaObject | ReferenceObject };
    private _handlers: Array<SchamesHander>;
    constructor(schames: { [schema: string]: SchemaObject | ReferenceObject }) {
        this._schemas = schames;
        this._handlers = [];
    }

    static from(schames: { [schema: string]: SchemaObject | ReferenceObject }) {
        return new SchamesHanders(schames);
    }

    register(handler: SchamesHander) {
        this._handlers.push(handler);
        return this;
    }

    toTS() {
        let ts = '';
        for (let schema in this._schemas) {
            for (let handler of this._handlers) {
                let res = handler(schema, this._schemas[schema]);
                if (res !== undefined) {
                    ts += res;
                    break;
                }
            }
        }
        return prettier.format(
            `namespace Models {
${ts}
}`,
            {
                parser: 'typescript',
            }
        );
    }
}

export class DOCHandler {
    private _doc: OpenAPIObject;

    constructor(doc: OpenAPIObject) {
        this._doc = doc;
        if (this._doc.openapi === undefined) {
            throw new Error('OpenAPI version is not defined');
        }
    }

    static from(doc: OpenAPIObject) {
        return new DOCHandler(doc);
    }

    resolveSchemas() {
        let schemas = this._doc.components?.schemas;
        if (schemas === undefined) {
            return;
        }
        console.log(
            SchamesHanders.from(schemas).register(objectHandler).toTS()
        );

        // for (let schemaName in schemas) {
        //     let schame = schemas[schemaName];
        //     console.log(schemaName, JSON.stringify(schame,null,2));
        // }
    }
}

export default DOCHandler;
