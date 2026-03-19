import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import type {
	RouterConfig,
	RouterPinByProfile,
	RouterThinkingByProfile,
	RoutingDecision,
	RouterTier,
} from "./types";
import {
	profileNames,
	resolveProfileName,
	THINKING_LEVELS,
	ROUTER_PIN_VALUES,
	parseCanonicalModelRef,
} from "./config";
import { formatPinSummary, formatThinkingSummary, formatModelRef, formatDecision } from "./ui";

export function registerCommands(
	pi: ExtensionAPI,
	state: {
		readonly currentConfig: RouterConfig;
		routerEnabled: boolean;
		selectedProfile: string;
		readonly pinnedTierByProfile: RouterPinByProfile;
		readonly thinkingByProfile: RouterThinkingByProfile;
		readonly lastDecision: RoutingDecision | undefined;
		lastNonRouterModel: string | undefined;
		readonly accumulatedCost: number;
		debugEnabled: boolean;
		widgetEnabled: boolean;
		readonly debugHistory: RoutingDecision[];
	},
	actions: {
		persistState: () => void;
		updateStatus: (ctx: ExtensionContext) => void;
		reloadConfig: (ctx?: ExtensionContext, options?: { preserveDebug?: boolean }) => void;
		ensureValidActiveRouterProfile: (ctx: ExtensionContext) => Promise<void>;
		switchToRouterProfile: (profileName: string, ctx: ExtensionContext, strict?: boolean) => Promise<boolean>;
	}
) {
	const getRouterPinArgumentCompletions = (prefix: string) => {
		const trimmedLeft = prefix.trimStart();
		const hasTrailingSpace = /\s$/.test(prefix);
		const parts = trimmedLeft.length > 0 ? trimmedLeft.split(/\s+/) : [];

		if (parts.length === 0) {
			return [
				...ROUTER_PIN_VALUES.map((value) => ({ value, label: value })),
				...profileNames(state.currentConfig).map((name) => ({ value: name, label: `router/${name}` })),
			];
		}

		if (parts.length === 1 && !hasTrailingSpace) {
			const token = parts[0];
			const pinItems = ROUTER_PIN_VALUES.filter((value) => value.startsWith(token)).map((value) => ({
				value,
				label: value,
			}));
			const profileItems = profileNames(state.currentConfig)
				.filter((name) => name.startsWith(token))
				.map((name) => ({ value: name, label: `router/${name}` }));
			const items = [...pinItems, ...profileItems];
			return items.length > 0 ? items : null;
		}

		const profileToken = parts[0];
		if (!state.currentConfig.profiles[profileToken]) {
			return null;
		}
		const pinPrefix = hasTrailingSpace ? "" : (parts[1] ?? "");
		const items = ROUTER_PIN_VALUES.filter((value) => value.startsWith(pinPrefix)).map((value) => ({
			value: `${profileToken} ${value}`,
			label: `${profileToken} ${value}`,
		}));
		return items.length > 0 ? items : null;
	};

	pi.registerCommand("router", {
		description: "Show the current status of the model router",
		handler: async (_args, ctx) => {
			const names = profileNames(state.currentConfig).join(", ");
			const lines = [
				"Model Router Status:",
				`Router enabled: ${state.routerEnabled ? "yes" : "off"}`,
				`Selected profile: ${state.selectedProfile}`,
				`Selected profile pin: ${state.pinnedTierByProfile[state.selectedProfile] ?? "auto"}`,
				`Pins by profile: ${formatPinSummary(state.pinnedTierByProfile)}`,
				`Thinking overrides: ${formatThinkingSummary(state.thinkingByProfile)}`,
				`Widget: ${state.widgetEnabled ? "on" : "off"}`,
				`Phase bias: ${state.currentConfig.phaseBias}`,
				`Session cost: $${state.accumulatedCost.toFixed(4)}` + (state.currentConfig.maxSessionBudget ? ` / $${state.currentConfig.maxSessionBudget.toFixed(2)}` : ""),
				`Default profile: ${resolveProfileName(state.currentConfig, state.currentConfig.defaultProfile)}`,
				`Available profiles: ${names}`,
				`Last non-router model: ${formatModelRef(state.lastNonRouterModel)}`,
				`Debug: ${state.debugEnabled ? "on" : "off"}`,
				`Debug history: ${state.debugHistory.length} decisions`,
			];
			if (state.lastDecision) {
				lines.push(
					`Last routed tier: ${state.lastDecision.tier}`,
					`Last phase: ${state.lastDecision.phase}`,
					`Last model: ${state.lastDecision.targetProvider}/${state.lastDecision.targetModelId} (${state.lastDecision.thinking})`,
					`Reason: ${state.lastDecision.reasoning}`,
				);
			}
			ctx.ui.notify(lines.join("\n"), "info");
			actions.updateStatus(ctx);
		},
	});

	pi.registerCommand("router-on", {
		description: "Enable the model router using the current or a specific profile",
		getArgumentCompletions: (prefix) => {
			const items = profileNames(state.currentConfig)
				.filter((name) => name.startsWith(prefix))
				.map((name) => ({ value: name, label: `router/${name}` }));
			return items.length > 0 ? items : null;
		},
		handler: async (args, ctx) => {
			const profileName = args?.trim() || state.selectedProfile;
			const success = await actions.switchToRouterProfile(profileName, ctx);
			if (success) {
				ctx.ui.notify(`Router enabled with profile: ${state.selectedProfile}`, "info");
			}
		},
	});

	pi.registerCommand("router-profile", {
		description: "Switch to a different router profile",
		getArgumentCompletions: (prefix) => {
			const items = profileNames(state.currentConfig)
				.filter((name) => name.startsWith(prefix))
				.map((name) => ({ value: name, label: `router/${name}` }));
			return items.length > 0 ? items : null;
		},
		handler: async (args, ctx) => {
			const profileName = args?.trim();
			if (!profileName) {
				ctx.ui.notify(`Current profile: ${state.selectedProfile}. Available: ${profileNames(state.currentConfig).join(", ")}`, "info");
				return;
			}
			const success = await actions.switchToRouterProfile(profileName, ctx);
			if (success) {
				ctx.ui.notify(`Switched to router profile: ${state.selectedProfile}`, "info");
			}
		},
	});

	pi.registerCommand("router-reload", {
		description: "Reload the model router configuration",
		handler: async (_args, ctx) => {
			actions.reloadConfig(ctx, { preserveDebug: true });
			await actions.ensureValidActiveRouterProfile(ctx);
			ctx.ui.notify(`Router config reloaded. Profiles: ${profileNames(state.currentConfig).join(", ")}`, "info");
		},
	});

	pi.registerCommand("router-debug", {
		description: "Toggle or clear router debug history",
		getArgumentCompletions: (prefix) => {
			const items = ["on", "off", "toggle", "clear", "show"].filter((v) => v.startsWith(prefix)).map((v) => ({ value: v, label: v }));
			return items.length > 0 ? items : null;
		},
		handler: async (args, ctx) => {
			const cmd = args?.trim().toLowerCase();
			if (cmd === "on") state.debugEnabled = true;
			else if (cmd === "off") state.debugEnabled = false;
			else if (cmd === "clear") state.debugHistory.length = 0;
			else if (cmd === "show") {
				if (state.debugHistory.length === 0) {
					ctx.ui.notify("No recent routing decisions.", "info");
				} else {
					const history = state.debugHistory
						.map((d) => `[${new Date(d.timestamp).toLocaleTimeString()}] ${formatDecision(d)}`)
						.join("\n");
					ctx.ui.notify(`Recent Routing Decisions:\n${history}`, "info");
				}
				return;
			} else {
				state.debugEnabled = !state.debugEnabled;
			}
			actions.persistState();
			ctx.ui.notify(`Router debug ${state.debugEnabled ? "enabled" : "disabled"}.`, "info");
		},
	});

	pi.registerCommand("router-widget", {
		description: "Toggle the router status widget",
		getArgumentCompletions: (prefix) => {
			const items = ["on", "off", "toggle"].filter((v) => v.startsWith(prefix)).map((v) => ({ value: v, label: v }));
			return items.length > 0 ? items : null;
		},
		handler: async (args, ctx) => {
			const cmd = args?.trim().toLowerCase();
			if (cmd === "on") state.widgetEnabled = true;
			else if (cmd === "off") state.widgetEnabled = false;
			else state.widgetEnabled = !state.widgetEnabled;
			actions.persistState();
			actions.updateStatus(ctx);
			ctx.ui.notify(`Router widget ${state.widgetEnabled ? "enabled" : "disabled"}.`, "info");
		},
	});

	pi.registerCommand("router-thinking", {
		description: "Override thinking level for a tier or profile",
		getArgumentCompletions: (prefix) => {
			const trimmedLeft = prefix.trimStart();
			const hasTrailingSpace = /\s$/.test(prefix);
			const parts = trimmedLeft.length > 0 ? trimmedLeft.split(/\s+/) : [];

			const tierValues = ["high", "medium", "low"];
			const levelValues = ["auto", ...THINKING_LEVELS];

			if (parts.length === 0) {
				return [
					...levelValues.map((v) => ({ value: v, label: v })),
					...tierValues.map((v) => ({ value: v, label: v })),
					...profileNames(state.currentConfig).map((name) => ({ value: name, label: `router/${name}` })),
				];
			}

			if (parts.length === 1 && !hasTrailingSpace) {
				const token = parts[0];
				return [
					...levelValues.filter((v) => v.startsWith(token)).map((v) => ({ value: v, label: v })),
					...tierValues.filter((v) => v.startsWith(token)).map((v) => ({ value: v, label: v })),
					...profileNames(state.currentConfig)
						.filter((name) => name.startsWith(token))
						.map((name) => ({ value: name, label: `router/${name}` })),
				];
			}

			if (levelValues.includes(parts[0])) {
				return null;
			}

			if (tierValues.includes(parts[0])) {
				const tier = parts[0];
				const levelPrefix = hasTrailingSpace ? "" : (parts[1] ?? "");
				return levelValues
					.filter((v) => v.startsWith(levelPrefix))
					.map((v) => ({ value: `${tier} ${v}`, label: `${tier} ${v}` }));
			}

			if (state.currentConfig.profiles[parts[0]]) {
				const profile = parts[0];
				const nextPrefix = hasTrailingSpace ? "" : (parts[1] ?? "");

				if (parts.length === 2 && !hasTrailingSpace) {
					return [
						...tierValues.filter((v) => v.startsWith(nextPrefix)).map((v) => ({ value: `${profile} ${v}`, label: v })),
						...levelValues
							.filter((v) => v.startsWith(nextPrefix))
							.map((v) => ({ value: `${profile} ${v}`, label: v })),
					];
				}

				if (levelValues.includes(parts[1])) {
					return null;
				}

				if (tierValues.includes(parts[1])) {
					const tier = parts[1];
					const levelPrefix = hasTrailingSpace ? "" : (parts[2] ?? "");
					return levelValues
						.filter((v) => v.startsWith(levelPrefix))
						.map((v) => ({ value: `${profile} ${tier} ${v}`, label: v }));
				}
			}

			return null;
		},
		handler: async (args, ctx) => {
			const currentProfile = state.selectedProfile;
			const trimmed = args?.trim();
			if (!trimmed) {
				ctx.ui.notify(
					[
						`Profile: ${currentProfile}`,
						`Thinking overrides: ${JSON.stringify(state.thinkingByProfile[currentProfile] ?? {})}`,
						"Usage: /router-thinking <level|auto>",
						"   or: /router-thinking <tier> <level|auto>",
						"   or: /router-thinking <profile> <tier> <level|auto>",
					].join("\n"),
					"info",
				);
				return;
			}

			const parts = trimmed.split(/\s+/).filter(Boolean);
			let profileName = currentProfile;
			let tier: RouterTier | "all" | undefined = undefined;
			let levelValue = "";

			const tierValues = ["high", "medium", "low"];
			const levelValues = ["auto", ...THINKING_LEVELS];

			if (parts.length === 1) {
				levelValue = parts[0];
				tier = state.pinnedTierByProfile[profileName] ?? (state.lastDecision?.profile === profileName ? state.lastDecision.tier : "medium");
			} else if (parts.length === 2) {
				if (tierValues.includes(parts[0]) || parts[0] === "all") {
					tier = parts[0] as RouterTier | "all";
					levelValue = parts[1];
				} else {
					profileName = parts[0];
					levelValue = parts[1];
					tier = state.pinnedTierByProfile[profileName] ?? (state.lastDecision?.profile === profileName ? state.lastDecision.tier : "medium");
				}
			} else if (parts.length === 3) {
				profileName = parts[0];
				tier = parts[1] as RouterTier | "all";
				levelValue = parts[2];
			}

			if (!state.currentConfig.profiles[profileName]) {
				ctx.ui.notify(`Unknown router profile: ${profileName}`, "error");
				return;
			}
			if (tier !== "all" && !tierValues.includes(tier as string)) {
				ctx.ui.notify(`Invalid tier: ${tier}. Use high, medium, or low.`, "error");
				return;
			}
			if (!levelValues.includes(levelValue)) {
				ctx.ui.notify(`Invalid thinking level: ${levelValue}. Use auto or: ${THINKING_LEVELS.join(", ")}`, "error");
				return;
			}

			const nextLevel = levelValue === "auto" ? undefined : (levelValue as any);
			if (tier === "all") {
				for (const t of tierValues as RouterTier[]) {
					if (!state.thinkingByProfile[profileName]) state.thinkingByProfile[profileName] = {};
					if (nextLevel) state.thinkingByProfile[profileName]![t] = nextLevel;
					else delete state.thinkingByProfile[profileName]![t];
				}
			} else {
				if (!state.thinkingByProfile[profileName]) state.thinkingByProfile[profileName] = {};
				if (nextLevel) state.thinkingByProfile[profileName]![tier as RouterTier] = nextLevel;
				else delete state.thinkingByProfile[profileName]![tier as RouterTier];
			}
			if (state.thinkingByProfile[profileName] && Object.keys(state.thinkingByProfile[profileName]!).length === 0) {
				delete state.thinkingByProfile[profileName];
			}

			actions.persistState();
			actions.updateStatus(ctx);
			ctx.ui.notify(
				nextLevel
					? `Router profile ${profileName} thinking (${tier}) set to ${nextLevel}`
					: `Router profile ${profileName} thinking (${tier}) reset to config defaults`,
				"info",
			);
		},
	});

	pi.registerCommand("router-fix", {
		description: "Correct the last routing decision and pin that tier",
		getArgumentCompletions: (prefix) => {
			const items = ["high", "medium", "low"].filter((t) => t.startsWith(prefix.toLowerCase())).map((t) => ({ value: t, label: t }));
			return items.length > 0 ? items : null;
		},
		handler: async (args, ctx) => {
			const tier = args?.trim().toLowerCase();
			if (!tierValues.includes(tier)) {
				ctx.ui.notify("Usage: /router-fix <high|medium|low>", "error");
				return;
			}
			if (!state.lastDecision) {
				ctx.ui.notify("No recent routing decision to fix.", "warning");
				return;
			}
			state.pinnedTierByProfile[state.lastDecision.profile] = tier as RouterTier;
			actions.persistState();
			actions.updateStatus(ctx);
			ctx.ui.notify(`Router decision corrected. ${state.lastDecision.profile} is now pinned to ${tier}.`, "info");
		},
	});

	pi.registerCommand("router-pin", {
		description: "Pin routing for the current profile or a named profile",
		getArgumentCompletions: getRouterPinArgumentCompletions,
		handler: async (args, ctx) => {
			const currentProfile = state.selectedProfile;
			const trimmed = args?.trim();
			if (!trimmed) {
				ctx.ui.notify(
					[
						`Profile: ${currentProfile}`,
						`Pinned tier: ${state.pinnedTierByProfile[currentProfile] ?? "auto"}`,
						`Pins by profile: ${formatPinSummary(state.pinnedTierByProfile)}`,
						`Usage: /router-pin <high|medium|low|auto>`,
						`   or: /router-pin <profile> <high|medium|low|auto>`,
					].join("\n"),
					"info",
				);
				actions.updateStatus(ctx);
				return;
			}

			const parts = trimmed.split(/\s+/).filter(Boolean);
			let profileName = currentProfile;
			let pinValue = parts[0] ?? "";
			if (parts.length >= 2) {
				profileName = parts[0];
				pinValue = parts[1] ?? "";
			}
			if (!state.currentConfig.profiles[profileName]) {
				ctx.ui.notify(`Unknown router profile: ${profileName}`, "error");
				return;
			}
			if (!ROUTER_PIN_VALUES.includes(pinValue as any)) {
				ctx.ui.notify(`Invalid router pin: ${pinValue}. Use one of: ${ROUTER_PIN_VALUES.join(", ")}`, "error");
				return;
			}

			const nextTier = pinValue === "auto" ? undefined : (pinValue as RouterTier);
			if (nextTier) {
				state.pinnedTierByProfile[profileName] = nextTier;
			} else {
				delete state.pinnedTierByProfile[profileName];
			}
			actions.persistState();
			actions.updateStatus(ctx);
			ctx.ui.notify(
				nextTier
					? `Router profile ${profileName} pinned to ${nextTier}`
					: `Router profile ${profileName} pin cleared; heuristic routing restored`,
				"info",
			);
		},
	});

	pi.registerCommand("router-off", {
		description: "Disable the router by switching back to the last non-router model",
		handler: async (_args, ctx) => {
			if (!state.lastNonRouterModel) {
				ctx.ui.notify("No previous non-router model recorded. Use /model to pick a concrete model.", "warning");
				return;
			}
			const { provider, modelId } = parseCanonicalModelRef(state.lastNonRouterModel);
			const targetModel = ctx.modelRegistry.find(provider, modelId);
			if (!targetModel) {
				ctx.ui.notify(`Recorded non-router model is unavailable: ${state.lastNonRouterModel}`, "error");
				return;
			}
			const success = await pi.setModel(targetModel);
			if (!success) {
				ctx.ui.notify(`Failed to switch to ${state.lastNonRouterModel}`, "error");
				return;
			}
			state.routerEnabled = false;
			actions.persistState();
			actions.updateStatus(ctx);
			ctx.ui.notify(`Router disabled. Restored ${state.lastNonRouterModel}`, "info");
		},
	});
}

const tierValues = ["high", "medium", "low"];
