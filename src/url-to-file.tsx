import {
    Action,
    ActionPanel,
    Form,
    getPreferenceValues,
    Clipboard,
    showToast,
    Toast,
    confirmAlert,
    open,
    popToRoot, List,
} from "@raycast/api";
import { useForm, FormValidation, useFetch } from "@raycast/utils";
import { useEffect } from "react";

import * as Errors from "./utils/Error.json";
import {FormValues, Instance} from "./utils/Types";

type ErrorKey = keyof typeof Errors;

function getErrorMessage(key: ErrorKey) {
    return Errors[key];
}

async function download(
    values: FormValues,
    instance: Instance | undefined | { id: string; name: string; url: any; apiKey: any },
    cobaltInstance: string
) {
    const apiUrl = instance?.url;

    const apiKey = instance?.apiKey

    await showToast({
        style: Toast.Style.Animated,
        title: "Downloading",
    });
    console.log({
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(apiKey !== undefined ? { Authorization: `Api-Key ${apiKey}` } : {}),
    });
    await fetch(apiUrl, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
    ...(apiKey !== undefined ? { Authorization: `Api-Key ${apiKey}` } : {}),
        },
        body: JSON.stringify({
            url: values.url,
            downloadMode: values.downloadMode,
            filenameStyle: "nerdy",
        }),
        signal: AbortSignal.timeout(2500),
    })
        .then(async (response) => {
            const resJson = await response.json();
            if (!response.ok) {
                throw resJson;
            }
            return resJson;
        })
        .then(async (data) => {
            if (data && data.status === "tunnel") {
                await showToast({
                    style: Toast.Style.Animated,
                    title: "Tunnel created",
                    message: `Tunnel ${new URL(data.url).searchParams.get("id")} created.`,
                });
                await confirmAlert({
                    title: `Download ${data?.filename} ?`,
                    primaryAction: {
                        title: "Download",
                        onAction: async () => {
                            await showToast({
                                style: Toast.Style.Success,
                                title: "Download started",
                            });
                            await popToRoot();
                            await open(data.url);
                        },
                    },
                    dismissAction: {
                        title: "Cancel",
                        onAction: async () => {
                            await showToast({
                                style: Toast.Style.Failure,
                                title: "Download canceled",
                            });
                        },
                    },
                });
            }
        })
        .catch(async (error) => {
            if (error?.status === "error") {
                await showToast({
                    style: Toast.Style.Failure,
                    title: "Failed to download",
                    message: getErrorMessage(error?.error?.code),
                });
                return;
            }
            if (error?.name) {
                await showToast({
                    style: Toast.Style.Failure,
                    title: "Failed to download",
                    message: getErrorMessage(error?.error?.code),
                });
                return;
            }
            console.error({
                name: error.name,
            });
            await showToast({
                style: Toast.Style.Failure,
                title: error?.name || "Failed to download",
                message: getErrorMessage(error?.message),
            });
        });
}

export default function Command() {
    const { cobaltInstance, cobaltInstanceUrl, cobaltInstanceUseApiKey, cobaltInstanceApiKey } = getPreferenceValues();

    const { isLoading, data } = useFetch<Instance[]>(
        "https://raw.githubusercontent.com/MonsPropre/cobalt-for-raycast/main/assets/instances.json"
    );

    // Parse 'data' string JSON if needed
    let instances: Instance[] = [];
    if (typeof data === "string") {
        try {
            instances = JSON.parse(data);
        } catch (error) {
            instances = [];
            console.error("Failed to parse instances JSON:", error);
        }
    } else if (Array.isArray(data)) {
        instances = data;
    }

    const { handleSubmit, itemProps, reset } = useForm<FormValues>({
        async onSubmit(values) {
            const cobaltCustomInstance = {
                id: "custom",
                name: "Custom",
                url: cobaltInstanceUrl,
                apiKey: Boolean(cobaltInstanceUseApiKey) ? cobaltInstanceApiKey : undefined
            }
            await download(
                values,
                cobaltInstance === "public-instance" ? instances.find((instance) => instance.id === values.instance) : cobaltCustomInstance,
                cobaltInstance
            );
        },
        validation: {
            url: (value) => {
                try {
                    const url = new URL(value as string);
                    if (url.protocol !== "http:" && url.protocol !== "https:") {
                        return "Invalid protocol";
                    }
                    return;
                } catch (_) {
                    return "Invalid URL";
                }
            },
            downloadMode: FormValidation.Required,
        },
    });

    useEffect(() => {
        (async () => {
            const text = await Clipboard.readText();
            try {
                const url = new URL(text as string);
                if (url.protocol === "http:" || url.protocol === "https:") {
                    reset({ url: text, downloadMode: "auto" });
                }
            } catch (_) {
                // Do nothing
            }
        })();
    }, [reset]);

    return (
        <Form
            actions={
                <ActionPanel>
                    <Action.SubmitForm title="Submit" onSubmit={handleSubmit} />
                </ActionPanel>
            }
        >
            {cobaltInstance === "public-instance" && (
                <Form.Dropdown title="Instance" {...itemProps.instance}>
                    {instances.length > 0 ? (
                        instances.map((instance) => (
                            <Form.Dropdown.Item key={instance.url} value={instance.id} title={instance.name} />
                        ))
                    ) : (
                        <Form.Dropdown.Item value="" title="(Aucune instance trouvée)" />
                    )}
                </Form.Dropdown>
            )}

            <Form.TextField
                title="URL"
                placeholder="https://www.youtube.com/watch?v=ykaj0pS4A1A"
                {...itemProps.url}
            />

            <Form.Dropdown title="Download Mode" storeValue {...itemProps.downloadMode}>
                <Form.Dropdown.Item value="auto" title="Auto" icon="✨" />
                <Form.Dropdown.Item value="audio" title="Audio" icon="🎶" />
                <Form.Dropdown.Item value="mute" title="Mute" icon="🔇" />
            </Form.Dropdown>
        </Form>
    );
}


function SupportedSites() {
    return (
        <List>
            <List.Section title="Supported Sites">
                <List.Item title="Youtube" />
                <List.Item title="Bilibili" />
            </List.Section>
        </List>
    )
}