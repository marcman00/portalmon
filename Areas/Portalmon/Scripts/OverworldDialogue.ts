export interface DialogueSequence
{
	speaker: string;
	lines: string[];
}

export interface DialogueChoice
{
	label: string;
	action: () => void;
}

/**
 * Reusable typewriter dialogue state. Calling advance while text is typing
 * completes the line; calling it afterward advances or closes the sequence.
 */
export class OverworldDialogue
{
	public readonly visible: KnockoutObservable<boolean> = ko.observable(false);
	public readonly speaker: KnockoutObservable<string> = ko.observable("");
	public readonly text: KnockoutObservable<string> = ko.observable("");
	public readonly isTyping: KnockoutObservable<boolean> = ko.observable(false);
	public readonly choices: KnockoutObservableArray<DialogueChoice> = ko.observableArray([]);
	public readonly selectedChoiceIndex: KnockoutObservable<number> = ko.observable(0);
	public readonly isChoosing: KnockoutComputed<boolean> = ko.pureComputed(() =>
		this.visible() && !this.isTyping() && this.lineIndex >= this.lines.length - 1 && this.choices().length > 0,
	);
	public readonly advanceHint: KnockoutComputed<string> = ko.pureComputed(() =>
	{
		if (this.isTyping()) return "";
		if (this.isChoosing()) return "D-PAD · E CONFIRM";
		return this.lineIndex >= this.lines.length - 1 ? "E · CLOSE" : "E · NEXT";
	});

	private lines: string[] = [];
	private lineIndex: number = 0;
	private fullLine: string = "";
	private typeTimer: number | null = null;
	private onComplete: (() => void) | null = null;

	public open(sequence: DialogueSequence, onComplete?: () => void): void
	{
		this.stopTyping();
		this.speaker(sequence.speaker);
		this.lines = [...sequence.lines];
		this.lineIndex = 0;
		this.onComplete = onComplete ?? null;
		this.choices([]);
		this.selectedChoiceIndex(0);
		this.visible(true);
		this.typeCurrentLine();
	}

	public openChoice(sequence: DialogueSequence, choices: DialogueChoice[]): void
	{
		this.open(sequence);
		this.choices([...choices]);
	}

	public moveChoice(direction: number): void
	{
		if (!this.isChoosing()) return;
		const count = this.choices().length;
		this.selectedChoiceIndex((this.selectedChoiceIndex() + direction + count) % count);
	}

	public confirmChoice = (): void =>
	{
		if (!this.isChoosing()) return;
		const action = this.choices()[this.selectedChoiceIndex()]?.action;
		this.close();
		action?.();
	};

	public selectChoice = (choice: DialogueChoice): void =>
	{
		const index = this.choices().indexOf(choice);
		if (index < 0) return;
		this.selectedChoiceIndex(index);
		this.confirmChoice();
	};

	public advance = (): void =>
	{
		if (!this.visible()) return;
		if (this.isTyping())
		{
			this.stopTyping();
			this.text(this.fullLine);
			return;
		}
		if (this.isChoosing())
		{
			this.confirmChoice();
			return;
		}

		if (this.lineIndex >= this.lines.length - 1)
		{
			const callback = this.onComplete;
			this.close();
			callback?.();
			return;
		}

		this.lineIndex++;
		this.typeCurrentLine();
	};

	public close(): void
	{
		this.stopTyping();
		this.visible(false);
		this.speaker("");
		this.text("");
		this.lines = [];
		this.lineIndex = 0;
		this.fullLine = "";
		this.onComplete = null;
		this.choices([]);
		this.selectedChoiceIndex(0);
	}

	private typeCurrentLine(): void
	{
		this.stopTyping();
		this.fullLine = this.lines[this.lineIndex] ?? "";
		this.text("");
		if (!this.fullLine)
		{
			this.isTyping(false);
			return;
		}

		let characterIndex = 0;
		this.isTyping(true);
		this.typeTimer = window.setInterval(() =>
		{
			characterIndex++;
			this.text(this.fullLine.slice(0, characterIndex));
			if (characterIndex >= this.fullLine.length) this.stopTyping();
		}, 18);
	}

	private stopTyping(): void
	{
		if (this.typeTimer !== null)
		{
			window.clearInterval(this.typeTimer);
			this.typeTimer = null;
		}
		this.isTyping(false);
	}
}
