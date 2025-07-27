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
    popToRoot,
} from "@raycast/api";
import {useForm, FormValidation, useFetch} from "@raycast/utils";
import {useEffect} from "react";

import * as Errors from "./utils/Error.json";

type ErrorKey = keyof typeof Errors;

function getErrorMessage(key: ErrorKey) {
    return Errors[key];
}

type FormValues = {
    url: string;
    downloadMode: string;
    instance: string
};

async function download(values: FormValues, instanceUrl: string, customInstance: boolean, cobaltInstanceUseApiKey: boolean, apiKey: string) {
    const apiUrl = customInstance ? instanceUrl : "https://api.cobalt.tools";
    await showToast

    ({
        style: Toast.Style.Animated,
        title: "Downloading",
    });
    console.log({
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(customInstance && cobaltInstanceUseApiKey
            ? {Authorization: `Api-Key ${apiKey}`}
            : {}),
    });
    await fetch(apiUrl, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            ...(customInstance && cobaltInstanceUseApiKey
                ? {Authorization: `Api-Key ${apiKey}`}
                : {}),
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
    const {
        cobaltInstance,
        cobaltInstanceUrl,
        cobaltInstanceUseApiKey,
        cobaltInstanceApiKey,
    } = getPreferenceValues();
    const Instances = useFetch("https://raw.githubusercontent.com/MonsPropre/cobalt-for-raycast/refs/heads/main/assets/instances.json?token=GHSAT0AAAAAADGGP4XAVU6LXAVMXU425V4M2EGGDVA")
    const {handleSubmit, itemProps, reset} = useForm<FormValues>({
        async onSubmit(values) {
            await download(
                values,
                cobaltInstanceUrl,
                cobaltInstance,
                cobaltInstanceUseApiKey,
                cobaltInstanceApiKey,
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
                    reset({url: text, downloadMode: "auto"});
                }
            } catch (_) {
                // Do nothing
            }
        })();
    }, [reset]);

    return (
        <Form
            searchBarAccessory={
                <Form.LinkAccessory
                    text="Supported Sites"
                    target="https://github.com/baldy/cobalt-for-raycast#supported-sites"
                />
            }
            actions={
                <ActionPanel>
                    <Action.SubmitForm title="Submit" onSubmit={handleSubmit}/>
                </ActionPanel>
            }
        >
            <Form.Dropdown
                title="Favorite Language"
                {...itemProps.instance}
            >

            </Form.Dropdown>
            <Form.TextField
                title="URL"
                placeholder="https://www.youtube.com/watch?v=ykaj0pS4A1A"
                {...itemProps.url}
            />
            <Form.Dropdown
                title="Download Mode"
                storeValue
                {...itemProps.downloadMode}
            >
                <Form.Dropdown.Item value="auto" title="Auto" icon="✨"/>
                <Form.Dropdown.Item value="audio" title="Audio" icon="🎶"/>
                <Form.Dropdown.Item value="mute" title="Mute" icon="🔇"/>
            </Form.Dropdown>
        </Form>
    );
}
