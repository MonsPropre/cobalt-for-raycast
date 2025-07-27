export type FormValues = {
    url: string;
    downloadMode: string;
    instance: string;
};

export type Instance = {
    id: string;
    name: string;
    url: string;
    apiKey?: string;
};

export type instanceMetadata = {
    cobalt: object;
    git: object;
}

export type metadataCobalt = {
    version: string;
    url: string;
    startTime: string;
    services: string[];
}

export type metadataGit = {
    branch: string;
    commit: string;
    remote: string;
}