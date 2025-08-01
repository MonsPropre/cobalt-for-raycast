import { Action, ActionPanel, Cache, Color, getPreferenceValues, Icon, List, showToast, Toast } from "@raycast/api";
import { Instance } from "./utils/Types";
import { useEffect, useMemo, useState } from "react";
import { showFailureToast } from "@raycast/utils";

const cache = new Cache();
const CACHE_PREFIX = "version-instance:";
const CACHE_TTL = 1000 * 60 * 5;

type InstanceWithOnline = Instance & { online: boolean };
type CachedInstanceStatus = {
  timestamp: number;
  data: InstanceWithOnline;
};

async function checkInstanceOnline(instance: Instance): Promise<InstanceWithOnline> {
  let online = false;
  let version = undefined;
  let services = instance.services;
  try {
    if (instance.api) {
      const url = instance.protocol ? `${instance.protocol}://${instance.api}` : instance.api;
      const response = await fetch(new URL(url), {
        signal: AbortSignal.timeout(2000),
        cache: "no-store",
        headers: instance.apiKey ? { Authorization: `Bearer ${instance.apiKey}` } : undefined,
      });
      if (response.ok) {
        const data = await response.json();
        if (typeof data.cobalt?.version === "string") {
          online = true;
          version = data.cobalt.version;
          services = data.cobalt.services ?? instance.services;
        }
      }
    }
  } catch {
    online = false;
  }
  return {
    ...instance,
    version: version ?? instance.version,
    services,
    online,
  };
}

async function getInstanceWithCache(instance: Instance, force = false): Promise<InstanceWithOnline> {
  const key = CACHE_PREFIX + (instance.id ?? instance.api);
  if (!force) {
    const cached = cache.get(key);
    if (cached) {
      try {
        const data: CachedInstanceStatus = JSON.parse(cached);
        if (Date.now() - data.timestamp < CACHE_TTL) {
          return data.data;
        }
      } catch {
        // ignore
      }
    }
  }
  const fresh = await checkInstanceOnline(instance);
  cache.set(
    key,
    JSON.stringify({
      timestamp: Date.now(),
      data: fresh,
    }),
  );
  return fresh;
}

async function getAllInstancesWithCache(instances: Instance[], force = false) {
  return Promise.all(instances.map((instance) => getInstanceWithCache(instance, force)));
}

export default function Command() {
  const {
    enableCustomInstance,
    instancesSourceUrl = "https://instances.cobalt.best/instances.json",
    cobaltInstanceUrl,
    cobaltInstanceUseApiKey,
    sourceMinScore: srcMinScore,
  } = getPreferenceValues();

  const sourceMinScore = isNaN(Number(srcMinScore)) ? 50 : Number(srcMinScore);

  const [publicInstances, setPublicInstances] = useState<InstanceWithOnline[]>([]);
  const [customInstance, setCustomInstance] = useState<InstanceWithOnline | null>(null);
  const [customInstanceTried, setCustomInstanceTried] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selection, setSelection] = useState<string | null>(null);

  useEffect(() => {
    if (error) {
      (async () => {
        await showFailureToast(error, {
          title: "Something went wrong",
        });
      })();
    }
  }, [error]);

  const fetchAllInstances = async (force = false) => {
    setIsLoading(true);
    try {
      const resp = await fetch(instancesSourceUrl, {
        headers: {
          "User-Agent": "MonsPropre/cobalt-for-raycast (+https://github.com/MonsPropre/cobalt-for-raycast)",
        },
        signal: AbortSignal.timeout(3000),
      });
      const rawList: Instance[] = await resp.json();

      let customInst: InstanceWithOnline | null = null;
      let triedCustom = false;
      if (enableCustomInstance && cobaltInstanceUrl && cobaltInstanceUrl.trim() !== "") {
        triedCustom = true;
        const customToCheck: Instance = {
          id: "custom",
          name: cobaltInstanceUrl,
          api: cobaltInstanceUrl,
          apiKey: cobaltInstanceUseApiKey ? cobaltInstanceUseApiKey : undefined,
        };
        customInst = await getInstanceWithCache(customToCheck, force);
      }

      const publics = await getAllInstancesWithCache(rawList, force);

      setCustomInstance(customInst);
      setCustomInstanceTried(triedCustom);
      setPublicInstances(publics);
      setIsLoading(false);
    } catch (err) {
      setError(err as Error);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      await fetchAllInstances();
    })();
  }, [instancesSourceUrl, cobaltInstanceUrl, cobaltInstanceUseApiKey, enableCustomInstance]);

  useEffect(() => {
    const timer = setInterval(() => fetchAllInstances(), CACHE_TTL);
    return () => clearInterval(timer);
  }, [instancesSourceUrl, cobaltInstanceUrl, cobaltInstanceUseApiKey, enableCustomInstance]);

  const handleRefetch = async () => {
    await showToast({
      style: Toast.Style.Animated,
      title: "Check in progress...",
    });
    await fetchAllInstances(true);
    await showToast({ style: Toast.Style.Success, title: "Check complete!" });
  };

  const sortedPublicInstances: InstanceWithOnline[] = useMemo(
    () => publicInstances.slice().sort((a, b) => Number(b.online) - Number(a.online)),
    [publicInstances],
  );

  function getAccessoriesForInstance(instance: InstanceWithOnline) {
    const accessories = [];
    accessories.push({
      icon: {
        source: Icon.Link,
        tintColor: instance.online ? Color.Green : Color.Red,
      },
      tooltip: instance.online ? "Online" : "Offline",
    });
    if (instance.score === undefined || instance.score < sourceMinScore)
      accessories.push({
        icon: {
          source: Icon.Warning,
          tintColor: Color.Orange,
        },
      });
    accessories.push({
      text: instance.version ?? "unknown",
      tooltip: `Version: ${instance.version}`,
    });
    return accessories.filter(Boolean);
  }

  return (
    <List
      isLoading={isLoading}
      onSelectionChange={setSelection}
      isShowingDetail={
        selection !== null && selection !== "empty" && selection !== "errored" && selection !== "no-custom"
      }
      searchBarPlaceholder="Search instances..."
      actions={
        <ActionPanel>
          <Action title="Refetch Data" onAction={handleRefetch} />
        </ActionPanel>
      }
    >
      <List.Section title="Custom Instance">
        {enableCustomInstance && cobaltInstanceUrl && cobaltInstanceUrl.trim() !== "" && customInstance ? (
          <List.Item
            title={
              customInstance.name && customInstance.name.toLowerCase() !== "none"
                ? customInstance.name
                : customInstance.api
            }
            id="custom"
            accessories={getAccessoriesForInstance(customInstance) as List.Item.Accessory[]}
            actions={
              <ActionPanel>
                <Action title="Refetch Data" onAction={handleRefetch} />
              </ActionPanel>
            }
            detail={
              <List.Item.Detail
                metadata={
                  <List.Item.Detail.Metadata>
                    <List.Item.Detail.Metadata.Label title="URL" text={customInstance.api} />
                    <List.Item.Detail.Metadata.Label
                      title="Online"
                      text={customInstance.online ? "Yes" : "No"}
                      icon={
                        customInstance.online
                          ? { source: Icon.Link, tintColor: Color.Green }
                          : { source: Icon.Link, tintColor: Color.Red }
                      }
                    />
                    <List.Item.Detail.Metadata.Label title="Version" text={customInstance.version ?? "-"} />
                    <List.Item.Detail.Metadata.Label title="Use API Key" text={customInstance.apiKey ? "Yes" : "No"} />
                    <List.Item.Detail.Metadata.Label title="Frontend ?" text={customInstance.frontend ? "Yes" : "No"} />
                    {customInstance.services && customInstance.services.length > 0 && (
                      <List.Item.Detail.Metadata.TagList title="Services">
                        {customInstance.services.map((s) => (
                          <List.Item.Detail.Metadata.TagList.Item key={s} text={s} />
                        ))}
                      </List.Item.Detail.Metadata.TagList>
                    )}
                  </List.Item.Detail.Metadata>
                }
              />
            }
          />
        ) : enableCustomInstance && cobaltInstanceUrl && cobaltInstanceUrl.trim() !== "" && customInstanceTried ? (
          <List.Item
            id="no-custom"
            title="Custom instance unreachable or misconfigured"
            subtitle={cobaltInstanceUrl}
            icon={Icon.Warning}
          />
        ) : (
          <List.Item id="no-custom" title="No Custom Instance configured" icon={Icon.Minus} />
        )}
      </List.Section>
      <List.Section title="Public Instances">
        {sortedPublicInstances.length === 0 && !isLoading && (
          <List.Item
            id="empty"
            title="No instances found"
            subtitle="Check the source URL in preferences."
            accessories={[
              {
                icon: {
                  source: Icon.Warning,
                  tintColor: Color.Red,
                },
              },
            ]}
          />
        )}
        {sortedPublicInstances.map((instance) => (
          <List.Item
            key={instance.id ?? instance.api}
            title={instance.api ? new URL(`${instance.protocol ?? "https"}://${instance.api}`).hostname : instance.name}
            accessories={getAccessoriesForInstance(instance) as List.Item.Accessory[]}
            actions={
              <ActionPanel>
                <Action title="Refetch Data" onAction={handleRefetch} />
                {instance.frontend && (
                  <Action.OpenInBrowser
                    title="Open in Browser"
                    url={
                      instance.api.includes("://") ? instance.api : `${instance.protocol ?? "https"}://${instance.api}`
                    }
                  />
                )}
              </ActionPanel>
            }
            detail={
              <List.Item.Detail
                metadata={
                  <List.Item.Detail.Metadata>
                    <List.Item.Detail.Metadata.Label title="URL" text={instance.api} />
                    <List.Item.Detail.Metadata.Label
                      title="Online"
                      text={instance.online ? "Yes" : "No"}
                      icon={
                        instance.online
                          ? { source: Icon.Link, tintColor: Color.Green }
                          : { source: Icon.Link, tintColor: Color.Red }
                      }
                    />
                    <List.Item.Detail.Metadata.Label title="Version" text={instance.version ?? "-"} />
                    <List.Item.Detail.Metadata.Label title="Use API Key" text={instance.apiKey ? "Yes" : "No"} />
                    <List.Item.Detail.Metadata.Label title="Frontend ?" text={instance.frontend ? "Yes" : "No"} />
                    <List.Item.Detail.Metadata.Label
                      title="Score"
                      text={instance.score?.toFixed(0) ?? "-"}
                      icon={
                        instance.score === undefined || instance.score === 0 || instance.score < sourceMinScore
                          ? { source: Icon.Warning, tintColor: Color.Orange }
                          : undefined
                      }
                    />
                    {instance.services && instance.services.length > 0 && (
                      <List.Item.Detail.Metadata.TagList title="Services">
                        {instance.services.map((service) => (
                          <List.Item.Detail.Metadata.TagList.Item key={service} text={service} />
                        ))}
                      </List.Item.Detail.Metadata.TagList>
                    )}
                  </List.Item.Detail.Metadata>
                }
              />
            }
          />
        ))}
      </List.Section>
    </List>
  );
}
