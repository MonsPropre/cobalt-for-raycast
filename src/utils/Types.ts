export type FormValues = {
    url: string;
    downloadMode: string;
    instance: string;
};

export type CobaltInstance = {
    version: string;
    api: string;
    startTime: string;
    services: string[];
};

export type CobaltError = {
    code: string;
    context: {
        service: string;
    };
}

export type GitInstance = {
    branch: string;
    commit: string;
    remote: string;
};

export type Instance = {
    id: string;
    // cobalt?: CobaltInstance; // ici cobalt est typé précisément
    protocol?: string;
    git?: GitInstance;
    services?: string[];
    score?: number;
    name: string;
    api: string;
    version?: string;
    apiKey?: string;
    frontend?: string;
};

export type instanceMetadata = {
    cobalt: object;
    git: object;
};

export type metadataCobalt = {
    version: string;
    url: string;
    startTime: string;
    services: string[];
};

export type metadataGit = {
    branch: string;
    commit: string;
    remote: string;
};
