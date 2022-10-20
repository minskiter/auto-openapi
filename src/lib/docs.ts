import {
    OpenAPIObject,
    OperationObject,
    ParameterObject,
    PathItemObject,
    ReferenceObject,
    RequestBodyObject,
    SchemaObject,
} from 'openapi3-ts';
import {
    commonHandler,
    enumHandler,
    objectHandler,
    typeHandler,
} from './schemas/handers';
import prettier from 'prettier';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

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
        return prettier.format(ts, {
            parser: 'typescript',
        });
    }
}

export class DOCHandler {
    private _doc: OpenAPIObject;
    private _output: string;

    constructor(doc: OpenAPIObject, output: string) {
        this._doc = doc;
        this._output = output = output;
        if (this._doc.openapi === undefined) {
            throw new Error('OpenAPI version is not defined');
        }
    }

    static from(doc: OpenAPIObject, output: string) {
        return new DOCHandler(doc, output);
    }

    resolveSchemas() {
        let schemas = this._doc.components?.schemas;
        if (schemas === undefined) {
            return;
        }
        let modelCode = SchamesHanders.from(schemas)
            .register(objectHandler)
            .register(enumHandler)
            .register(commonHandler)
            .toTS();
        return fs.writeFile(path.join(this._output, 'models.ts'), modelCode, {
            encoding: 'utf-8',
        });
    }

    resolveCommon() {
        let requestCode = `import axios from './config';
        import { AxiosProgressEvent, AxiosResponse, ResponseType } from 'axios';
        
        export class Request {
            abortController?: AbortController;
            request?: Promise<AxiosResponse>;
            private _timeout?: number;
            private _headers?: object;
            private _params?: object;
            private _method?: string;
            private _url: string;
            private _onDownloadProgress?: (progressEvent: AxiosProgressEvent) => void;
            private _onUploadProgress?: (progressEvent: AxiosProgressEvent) => void;
            private _data: object | undefined;
            private _responseType?: ResponseType;
        
            constructor({
                url,
                method = 'get',
                params,
                headers,
                timeout,
                data,
                onUploadProgress,
                onDownloadProgress,
                responseType = 'json',
            }: {
                url: string;
                method: string;
                params?: object;
                headers?: object;
                timeout?: number;
                data?: object;
                onUploadProgress?: (progressEvent: AxiosProgressEvent) => void;
                onDownloadProgress?: (progressEvent: AxiosProgressEvent) => void;
                responseType?: ResponseType;
            }) {
                this._url = url;
                this._method = method;
                this._params = params;
                this._headers = headers;
                this._timeout = timeout;
                this._data = data;
                this._onUploadProgress = onUploadProgress;
                this._onDownloadProgress = onDownloadProgress;
                this._responseType = responseType;
            }
        
            url(): string;
            url(url: string): Request;
            url(url?: string): Request | string {
                if (url === undefined) {
                    return this._url;
                }
                this._url = url;
                return this;
            }
        
            data(): object | undefined;
            data(data: object): Request;
            data(data?: object): Request | object | undefined {
                if (data === undefined) {
                    return this._data;
                }
                this._data = data;
                return this;
            }
        
            timeout(): number | undefined;
            timeout(ms: number): Request;
            timeout(ms?: number): Request | number | undefined {
                if (ms === undefined) {
                    return this._timeout;
                }
                this._timeout = ms;
                return this;
            }
        
            headers(): object | undefined;
            headers(headers: object): Request;
            headers(headers?: object): Request | object | undefined {
                if (headers === undefined) {
                    return this._headers;
                }
                this._headers = headers;
                return this;
            }
        
            params(): object | undefined;
            params(params: object): Request;
            params(params?: object): Request | object | undefined {
                if (params === undefined) {
                    return this._params;
                }
                this._params = params;
                return this;
            }
        
            onDownloadProgress(): (
                progressEvent: AxiosProgressEvent
            ) => void | undefined;
            onDownloadProgress(
                progress?: (progressEvent: AxiosProgressEvent) => void
            ): Request;
            onDownloadProgress(
                progress?: (progressEvent: AxiosProgressEvent) => void
            ): Request | ((progressEvent: AxiosProgressEvent) => void) | undefined {
                if (progress === undefined) {
                    return this._onDownloadProgress;
                }
                this._onDownloadProgress = progress;
                return this;
            }
        
            onUploadProgress(): (progressEvent: AxiosProgressEvent) => void | undefined;
            onUploadProgress(
                progress?: (progressEvent: AxiosProgressEvent) => void
            ): Request;
            onUploadProgress(
                progress?: (progressEvent: AxiosProgressEvent) => void
            ): Request | ((progressEvent: AxiosProgressEvent) => void) | undefined {
                if (progress === undefined) {
                    return this._onUploadProgress;
                }
                this._onUploadProgress = progress;
                return this;
            }
        
            responseType(): string | undefined;
            responseType(responseType: ResponseType): Request;
            responseType(responseType?: ResponseType): Request | string | undefined {
                if (responseType === undefined) {
                    return this._responseType;
                }
                this._responseType = responseType;
                return this;
            }
        
            requestAsync(abort = true) {
                // abort previous request
                if (abort) {
                    this.abort();
                }
                this.abortController = new AbortController();
                return (this.request = axios(this._url, {
                    method: this._method,
                    signal: this.abortController.signal,
                    params: this._params,
                    headers: this._headers,
                    timeout: this._timeout,
                    onDownloadProgress: this._onDownloadProgress,
                    onUploadProgress: this._onUploadProgress,
                    responseType: this._responseType,
                }));
            }
        
            abort() {
                this.abortController?.abort();
            }
        }`;
        fs.writeFile(
            path.join(this._output, 'request.ts'),
            prettier.format(requestCode, {
                parser: 'typescript',
            }),
            {
                encoding: 'utf-8',
            }
        );
        let configCode = `import axios from 'axios'

        let instance = axios.create()
        
        instance.interceptors.request.use((config) => {
            if (config.headers !== undefined) {
                if (
                    config.headers['Content-Type'] === 'multipart/form-data' ||
                    config.headers['Content-Type'] ===
                        'application/x-www-form-urlencoded'
                ) {
                    let formData = new FormData();
                    for (let key in config.data) {
                        if (config.data[key] !== undefined) {
                            if (Array.isArray(config.data[key])) {
                                for (let i = 0; i < config.data[key].length; i++) {
                                    formData.append(
                                        \`\${key}[\${i}]\`,
                                        config.data[key][i]
                                    );
                                }
                            } else if (typeof config.data[key] === 'object') {
                                formData.append(key, JSON.stringify(config.data[key]));
                            } else {
                                formData.append(key, config.data[key]);
                            }
                        }
                    }
                    // overwrite data
                    config.data = formData;
                }
            }
            return config;
        });
        
        //config here
        
        export default instance;`;
        if (!existsSync(path.join(this._output, 'config.ts'))) {
            fs.writeFile(
                path.join(this._output, 'config.ts'),
                prettier.format(configCode, {
                    parser: 'typescript',
                }),
                {
                    encoding: 'utf-8',
                }
            );
        }
    }

    resolveAPI() {
        let paths = this._doc.paths;
        if (paths === undefined) {
            return;
        }
        const tagCollection: Record<string, any> = {};
        for (let path in paths) {
            let api: PathItemObject = paths[path];
            for (let method in api) {
                let operation = (api as Record<string, OperationObject>)[
                    method
                ];
                if (operation.operationId === undefined) {
                    throw new Error(
                        'operationId is not defined, see https://swagger.io/specification/#operation-object'
                    );
                }
                // resolve operatiorId
                if (operation.tags === undefined) {
                    throw new Error(
                        "operation's tag is not defined, see https://swagger.io/specification/#operation-object"
                    );
                }
                let contentType: string | undefined = undefined;
                let bodyType = undefined;
                if (operation.requestBody !== undefined) {
                    contentType = 'application/json';
                    let body = operation.requestBody as RequestBodyObject;
                    if (body.content !== undefined) {
                        contentType = Object.keys(body.content)[0];
                        if (body.content[contentType] !== undefined) {
                            let s = body.content[contentType].schema;
                            if (s != undefined) {
                                bodyType = typeHandler(s, 'Models');
                            }
                        }
                    }
                }
                let params: Record<string, string> = {};
                let pathParams: Record<string, string> = {};
                let headerParams: Record<string, string> = {};
                let paramsT = ``;
                let pathParamsT = ``;
                let headerParamsT = ``;
                if (operation.parameters !== undefined) {
                    for (let parameter of operation.parameters) {
                        let param = parameter as ParameterObject;
                        if (param.in === 'query') {
                            if (
                                param.schema !== undefined &&
                                param.name !== undefined
                            ) {
                                let type = typeHandler(param.schema, 'Models');
                                if (type !== undefined) {
                                    params[param.name] = type;
                                    if (
                                        param.required === true ||
                                        (param.schema as SchemaObject)
                                            ?.nullable !== undefined
                                    ) {
                                        paramsT += `${param.name}: ${type};\n`;
                                    } else {
                                        paramsT += `${param.name}?: ${type};\n`;
                                    }
                                }
                            }
                        } else if (param.in === 'path') {
                            if (
                                param.schema !== undefined &&
                                param.name !== undefined
                            ) {
                                let type = typeHandler(param.schema, 'Models');
                                if (type !== undefined) {
                                    pathParams[param.name] = type;
                                    if (
                                        param.required === true ||
                                        (param.schema as SchemaObject)
                                            ?.nullable !== undefined
                                    ) {
                                        pathParamsT += `${param.name}: ${type};\n`;
                                    } else {
                                        pathParamsT += `${param.name}?: ${type};\n`;
                                    }
                                }
                            }
                        } else if (param.in === 'header') {
                            if (
                                param.schema !== undefined &&
                                param.name !== undefined
                            ) {
                                let type = typeHandler(param.schema, 'Models');
                                if (type !== undefined) {
                                    headerParams[param.name] = type;
                                    if (
                                        param.required === true ||
                                        (param.schema as SchemaObject)
                                            ?.nullable !== undefined
                                    ) {
                                        headerParamsT += `${param.name}: ${type};\n`;
                                    } else {
                                        headerParamsT += `${param.name}?: ${type};\n`;
                                    }
                                }
                            }
                        }
                    }
                }
                let pathT: string = path;
                for (let name in pathParams) {
                    pathT.replaceAll(`{${name}}`, `\${path.${name}}`);
                }
                let emptyParams =
                    Object.keys(params).length === 0 &&
                    bodyType === undefined &&
                    Object.keys(headerParams).length === 0 &&
                    Object.keys(pathParams).length === 0;
                let template = `
                /**
                 * @description ${
                     operation.summary === undefined ? '...' : operation.summary
                 }
                 */
                static ${operation.operationId}(${
                    !emptyParams
                        ? `{
                      ${Object.keys(params).length > 0 ? 'query,' : ''}
                      ${bodyType === undefined ? '' : 'body,'}
                      ${Object.keys(pathParams).length > 0 ? 'path,' : ''}
                      ${Object.keys(headerParams).length > 0 ? 'header' : ''}
                }:{
                    ${
                        // query
                        Object.keys(params).length > 0
                            ? `query: {
                    ${paramsT} },`
                            : ''
                    }
                    ${
                        // body
                        bodyType === undefined ? '' : `body: ${bodyType},`
                    }
                    ${
                        // path
                        Object.keys(pathParams).length > 0
                            ? `path:
                    {${pathParamsT}},`
                            : ''
                    }        
                    ${
                        // headers
                        Object.keys(headerParams).length > 0
                            ? `header:
                    {${headerParamsT}}`
                            : ''
                    }
                }`
                        : ''
                }) {
                    let request = new Request({
                        url: '${pathT}',
                        method: '${method}',
                        ${
                            Object.keys(params).length > 0
                                ? `params: query,`
                                : ''
                        }
                        ${bodyType === undefined ? '' : `data: body,`}
                    })
                    ${
                        contentType !== undefined ||
                        Object.keys(headerParams).length > 0
                            ? `request.headers({
                            ${
                                contentType !== undefined
                                    ? `"Content-Type": "${contentType}",`
                                    : ''
                            }
                            ${
                                Object.keys(headerParams).length > 0
                                    ? Object.keys(headerParams)
                                          .map(
                                              (name) =>
                                                  `"${name}": header.${name}`
                                          )
                                          .join(',\n')
                                    : ''
                            }
                        })`
                            : ''
                    }
                    return request;
                }`;
                for (let tag of operation.tags) {
                    if (tagCollection[tag] === undefined) {
                        tagCollection[tag] = {};
                    }
                    tagCollection[tag][operation.operationId] = template;
                }
            }
        }
        let template = `
import { Request } from './request';
import * as Models from "./models";
        `;
        let tagTs: string[] = [];
        for (let tag in tagCollection) {
            let tagT = `
            export class ${tag} {
                ${Object.values(tagCollection[tag]).join('\n')}
            }
            `;
            tagTs.push(tagT);
        }
        template += `${tagTs.join('\n')}`;
        return fs.writeFile(
            path.join(this._output, 'api.ts'),
            prettier.format(template, { parser: 'typescript' }),
            {
                encoding: 'utf-8',
            }
        );
    }
}

export default DOCHandler;
