import {Action, ActionPanel, Clipboard, Color, getPreferenceValues, Icon, List, open} from "@raycast/api";
import {Instance} from "./utils/Types";
import {useEffect, useState} from "react";

import * as Errors from "./utils/Error.json";

type ErrorKey = keyof typeof Errors;

function getErrorMessage(key: ErrorKey) {
    return Errors[key];
}

export default function Command() {
    const {
        instanceSourceUrl = "https://raw.githubusercontent.com/MonsPropre/cobalt-for-raycast/main/assets/instances.json",
        cobaltInstanceUrl,
        cobaltInstanceUseApiKey
    } = getPreferenceValues();

    const [data, setData] = useState<Instance[]>([]);
    const [error, setError] = useState<Error | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);

    const [selection, setSelection] = useState<string | null>(null);

    const [emptyId, setEmptyId] = useState<string>("empty");

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                const response = await fetch(instanceSourceUrl, {
                    signal: AbortSignal.timeout(2500),
                    cache: "force-cache"
                });
                const d = await response.json();
                setData(d);
            } catch (error) {
                setError(error as Error);
                setEmptyId("errored");
            }
            setIsLoading(false);
        };
        fetchData();
    }, [instanceSourceUrl]);

    let instances: Instance[] = [];
    if (Array.isArray(data)) {
        instances = data;
    }

    return (
        <List isLoading={isLoading} onSelectionChange={setSelection} isShowingDetail={selection !== null && selection !== "empty" && selection !== "errored"}>
            <List.Section title="Custom Instance">
                <List.Item
                    title="Custom"
                    id="custom"
                    subtitle={cobaltInstanceUrl}
                    actions={
                        <ActionPanel>
                            <Action
                                title="Open GitHub"
                                onAction={async () => {
                                    await open("https://github.com/MonsPropre/cobalt-for-raycast");
                                }}
                            />
                        </ActionPanel>
                    }
                    detail={
                        <List.Item.Detail
                            metadata={
                                <List.Item.Detail.Metadata>
                                    <List.Item.Detail.Metadata.Label
                                        title="Id"
                                        text={"00000000-0000-0000-0000-000000000000"}
                                    />
                                    <List.Item.Detail.Metadata.Label
                                        title="Name"
                                        text={"Custom"}
                                    />
                                    <List.Item.Detail.Metadata.Label
                                        title="Use API Key"
                                        text={cobaltInstanceUseApiKey ? "Yes" : "No"}
                                    />
                                </List.Item.Detail.Metadata>
                            }
                        />
                    }
                />
            </List.Section>
            <List.Section title="Public Instances">
                {instances.length === 0 && !isLoading && (
                    <List.Item
                        id={emptyId}
                        title="No instances found"
                        subtitle="Check the source URL in preferences."
                        accessories={
                            [
                                {
                                    icon: {
                                        source: Icon.Warning,
                                        tintColor: Color.Red
                                    },
                                    text: getErrorMessage("Short" + error?.name as ErrorKey)
                                }
                            ]
                        }
                    />
                )}
                {instances.map((instance) => {
                    return (
                        <List.Item
                            key={instance.id ?? instance.url} // fallback si id absent
                            title={instance.name}
                            subtitle={instance.url}
                            accessories={
                                [
                                    {
                                        icon: {
                                            source: Icon.AppWindow,
                                            tintColor: instance.frontendUrl ? Color.Green : Color.Red
                                        }
                                    }
                                ]
                            }
                            actions={
                                <ActionPanel title={instance.name}>
                                    <ActionPanel.Section>
                                        <Action
                                            title="Copy URL"
                                            onAction={async () => {
                                                await Clipboard.copy(instance.url);
                                            }}
                                        />
                                    </ActionPanel.Section>
                                </ActionPanel>
                            }
                            detail={
                                <List.Item.Detail
                                    metadata={
                                        <List.Item.Detail.Metadata>
                                            <List.Item.Detail.Metadata.Label
                                                title="Id"
                                                text={instance?.id}
                                            />
                                            <List.Item.Detail.Metadata.Label
                                                title="Name"
                                                text={instance?.name}
                                            />
                                            {instance?.version && (
                                                <List.Item.Detail.Metadata.Label
                                                    title="Version"
                                                    text={instance?.version}
                                                />
                                            )}
                                            <List.Item.Detail.Metadata.Label
                                                title="Use API Key"
                                                text={instance?.apiKey ? "Yes" : "No"}
                                            />
                                            <List.Item.Detail.Metadata.Label
                                                title="Frontend ?"
                                                text={instance?.frontendUrl ? "Yes" : "No"}
                                            />
                                        </List.Item.Detail.Metadata>
                                    }
                                />
                            }
                        />
                    );
                })}
            </List.Section>
        </List>
    );
}
