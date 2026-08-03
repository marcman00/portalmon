export interface DialogueSequence
{
	speaker: string;
	lines: string[];
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
	public readonly advanceHint: KnockoutComputed<string> = ko.pureComputed(() =>
	{
		if (this.isTyping()) return "";
		return this.lineIndex >= this.lines.length - 1 ? "E · CLOSE" : "E · NEXT";
	});

	private lines: string[] = [];
	private lineIndex: number = 0;
	private fullLine: string = "";
	private typeTimer: number | null = null;

	public open(sequence: DialogueSequence): void
	{
		this.stopTyping();
		this.speaker(sequence.speaker);
		this.lines = [...sequence.lines];
		this.lineIndex = 0;
		this.visible(true);
		this.typeCurrentLine();
	}

	public advance = (): void =>
	{
		if (!this.visible()) return;
		if (this.isTyping())
		{
			this.stopTyping();
			this.text(this.fullLine);
			return;
		}

		if (this.lineIndex >= this.lines.length - 1)
		{
			this.close();
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
