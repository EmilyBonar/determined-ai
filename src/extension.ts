// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import cp = require('child_process');
import { time } from 'console';
var clipboard = require('node-clipboardy');

interface IExtensionApi {
	ready: Promise<void>;
	debug: {
			getRemoteLauncherCommand(host: string, port: number, waitUntilDebuggerAttaches: boolean): Promise<string[]>;
			getDebuggerPackagePath(): Promise<string | undefined>;
	};
	settings: {
			readonly onDidChangeExecutionDetails: vscode.Event<vscode.Uri | undefined>;
			getExecutionDetails(resource?: vscode.Uri | undefined): {
					execCommand: string[] | undefined;
			};
			defaultInterpreterPath: string;
	};
	exports: any;
}

async function getPythonExtensionAPI(): Promise<IExtensionApi | undefined> {
	const extension = vscode.extensions.getExtension('ms-python.python');
	if (extension) {
			if (!extension.isActive) {
					await extension.activate();
			}
	}

	return extension?.exports as IExtensionApi;
}

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	let disposable = vscode.commands.registerCommand('determined-ai.openInDetermined', 
	async (uri:vscode.Uri | undefined = vscode.workspace.workspaceFolders?.[0].uri) => {
		// The code you place here will be executed every time your command is executed
		// Display a message box to the user
		if (!uri) {
			vscode.window.showInformationMessage("No context directory selected.");
			return;
		}
		const extension = await getPythonExtensionAPI();

		if (!extension) {
			vscode.window.showInformationMessage("Python VSCode extension not installed.");
			return;
		}

		const DET_MASTER = "ec2-18-236-10-57.us-west-2.compute.amazonaws.com";
		const defaultInterpreterPath = vscode.workspace.getConfiguration('python').get('defaultInterpreterPath') as string;

		const uuidProcess = cp.spawnSync("source " + defaultInterpreterPath.replace('python', 'activate'),
			['&&', 'det',`-m ${DET_MASTER}`, 'shell', 'start', '--detach', `-c ${uri.path}`], 
			{shell:true, encoding: 'utf-8'});
		
		const outputArr = uuidProcess.stdout.split(/(\s+)/);

		console.log(outputArr);

		const uuid = outputArr[178];

		console.log({uuid});

		let ssh = {stdout: ''};

		const wait = (ms: number) => new Promise(r => setTimeout(r, ms));

		const sshFunc = async () => {
			return cp.spawnSync("source " + defaultInterpreterPath.replace('python', 'activate'),
				['&&', 'det',`-m ${DET_MASTER}`, 'shell', 'show_ssh_command', uuid], 
				{shell:true, encoding: 'utf-8'});
		};
		while (ssh.stdout === '') {
			ssh = await sshFunc();
			await wait(1000);
		}
		const sshCommand = ssh.stdout.replace('\u001b[33m', '').replace('\u001b[0m', '');
		clipboard.writeSync(sshCommand);
		
		await vscode.commands.executeCommand('opensshremotes.addNewSshHost');

		clipboard.writeSync(uuid);
		await vscode.commands.executeCommand('opensshremotes.openEmptyWindow', uuid);
	});

	context.subscriptions.push(disposable);
}

// this method is called when your extension is deactivated
export function deactivate() {}
