#! /usr/bin/env node
import { run, subcommands } from "cmd-ts";
import * as p from "@clack/prompts";
import color from "picocolors";
import { handleAdd } from "./command_handlers/add";
import { handleNew } from "./command_handlers/new";
import { handleMode } from "./command_handlers/start/mode";
import { handleAdapter } from "./command_handlers/start/adapter";
import { handleData } from "./command_handlers/start/data";
import { handleRoute } from "./command_handlers/start/route";

import { t, setLocale, getField } from "@solid-cli/utils";
import { name, version } from "../package.json";
import { readConfig } from "@solid-cli/utils";
import loadCommands from "./plugins/plugins_entry";
import updater from "tiny-updater";
import { createAsync } from "@solid-cli/reactivity";
import { handleApi } from "./command_handlers/start/api";
import { flushCommandUpdates, flushFileUpdates, flushPackageUpdates, summarizeUpdates } from "@solid-cli/utils/updates";
import { spinnerify } from "./lib/utils/ui";
const possibleActions = () =>
	[
		{ value: "add", label: t.ACTION_ADD, hint: "solid add ..." },
		{ value: "new", label: t.ACTION_NEW, hint: "solid new ..." },
		{ value: "start", label: t.ACTION_START, hint: "solid start ..." },
	] as const;

export const provideStartSuggestions = async () => {
	let startAction = await p.select({
		message: t.SELECT_START_ACTION,
		options: [
			{ value: "mode", label: t.START_MODE, hint: t.START_MODE_HINT },
			{ value: "route", label: t.START_ROUTE, hint: t.START_ROUTE_HINT },
			{ value: "data", label: t.START_DATA, hint: t.START_DATA_HINT },
			{
				value: "adapter",
				label: t.START_ADAPTER,
				hint: t.START_ADAPTER_HINT,
			},
			{
				value: "api",
				label: t.START_API,
				hint: t.START_API_HINT,
			},
		],
	});
	switch (startAction) {
		case "mode":
			await handleMode();
			break;
		case "route":
			await handleRoute();
			break;
		case "data":
			await handleData();
			break;
		case "adapter":
			await handleAdapter();
			break;
		case "api":
			await handleApi();
			break;
	}
};

const provideSuggestions = async () => {
	type ActionType = ReturnType<typeof possibleActions>[number]["value"];
	let action = (await p.select({
		message: t.SELECT_ACTION,
		// This thing really doesn't like `as const` things
		options: possibleActions() as any,
	})) as ActionType;
	if (!action) return;
	switch (action) {
		case "add":
			await handleAdd();
			break;
		case "new":
			await handleNew();
			break;
		case "start":
			await provideStartSuggestions();
			break;
	}
};

const main = async () => {
	p.intro(`${color.bgCyan(color.black(" Solid-CLI "))}`);
	await readConfig();
	const needsUpdate = createAsync(async () => await updater({ name, version, ttl: 86_400_000 }));
	setLocale(getField("lang"));
	const cli = subcommands({
		name: "solid",
		cmds: await loadCommands(),
		version: version,
	});
	const args = process.argv.slice(2);

	if (args.length === 0) {
		await provideSuggestions();
		return;
	}

	if (args.length === 1 && args[0] === "start") {
		await provideStartSuggestions();
		return;
	}

	await run(cli, args);
	console.log("The following things will be updated:", summarizeUpdates());
	const confirmed = await p.confirm({ message: "Do you wish to continue?" });
	if (!confirmed) return;
	await spinnerify({ startText: "Writing files...", finishText: "Updates written", fn: flushFileUpdates });
	await spinnerify({ startText: "Installing packages...", finishText: "Packages installed", fn: flushPackageUpdates });
	await spinnerify({ startText: "Running setup commands", finishText: "Setup commands ran", fn: flushCommandUpdates });
};
main();
