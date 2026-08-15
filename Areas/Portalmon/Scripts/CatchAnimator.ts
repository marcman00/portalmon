import { SoundHandler } from "./SoundManager";

/**
 * CatchAnimator - drives the Portalmon catch-ball animation sequence.
 *
 * --- WIRING REQUIRED --------------------------------------------------------
 *
 * 1. Add to PortalmonController:
 *
 *      public catchAnim = new CatchAnimator();
 *
 *      public initiateCatch = async (): Promise<void> =>
 *      {
 *          const wiggles = Math.floor(Math.random() * 3); // 0, 1, or 2
 *          const caught  = this.combatManager.computeCatchResult();
 *          await this.catchAnim.play(wiggles, caught);
 *          this.combatManager.applyCatchResult(caught);
 *      };
 *
 * 2. Add to CombatManager:
 *
 *      // Pure roll - same catch-rate logic as contain(), NO side effects.
 *      public computeCatchResult(): boolean { ... }
 *
 *      // Apply the pre-rolled result: update dex/party, announcer, end battle or
 *      // resume the enemy turn, exactly as the current contain() does after rolling.
 *      public applyCatchResult(caught: boolean): void { ... }
 *
 * 3. In Encounter.cshtml:
 *      - CONTAIN button:  click: function() { $root.initiateCatch(); }
 *                         enable: canAct() && canContain() && !$root.catchAnim.isActive()
 *      - Enemy sprite:    add  data-bind="visible: !$root.catchAnim.isActive() || $root.catchAnim.enemyVisible()"
 *      - Ball element:    add inside .pk-battlefield (see Encounter.cshtml)
 * ----------------------------------------------------------------------------
 */
export class CatchAnimator
{
	/** True while any part of the sequence is running. Use to block all other UI input. */
	public isActive: KnockoutObservable<boolean> = ko.observable(false);

	/**
	 * Current animation phase - bound to CSS classes on the ball element.
	 * 'idle' | 'flying' | 'absorbing' | 'wiggling' | 'settling' | 'caught' | 'escaped'
	 */
	public phase: KnockoutObservable<string> = ko.observable('idle');

	/** Hides the enemy sprite while the ball has "absorbed" it. */
	public enemyVisible: KnockoutObservable<boolean> = ko.observable(true);

	/** Return the animator to its idle state, used when the result screen is dismissed. */
	public reset = (): void =>
	{
		this.phase('idle');
		this.enemyVisible(true);
		this.isActive(false);
	};

	private delay(ms: number): Promise<void>
	{
		return new Promise(resolve => setTimeout(resolve, ms));
	}

	/**
	 * Plays the full animation sequence then resolves.
	 * Call applyCatchResult() after this promise resolves.
	 *
	 * @param wiggles  0-2 wiggles before resolution
	 * @param caught   Whether the catch succeeds
	 */
	public play = async (wiggles: number, caught: boolean, sh: SoundHandler): Promise<void> =>
	{

		this.isActive(true);
		this.enemyVisible(true);
		this.phase('idle');

		// Tiny pause so the click feels intentional before the ball appears
		await this.delay(80);
		sh.playThrowSound();

		// -- 1. Ball flies to enemy (matches pk-catch-throw duration) ----------
		this.phase('flying');
		await this.delay(700);

		// -- 2. Enemy disappears, ball flashes to show absorption --------------
		this.enemyVisible(false);
		this.phase('absorbing');
		await this.delay(350);

		// -- 3. Wiggles --------------------------------------------------------
		// Toggling 'settling' -> 'wiggling' forces the CSS animation to restart
		// cleanly on each iteration rather than continuing from where it left off.
		for (let i = 0; i < wiggles; i++)
		{
			sh.playWigglesound();
			this.phase('settling');
			await this.delay(180);
			this.phase('wiggling');
			await this.delay(650);
		}

		// -- 4. Resolution -----------------------------------------------------
		if (caught)
		{
			this.phase('caught');
			await this.delay(1000);
			return;
		}
		else
		{
			this.phase('escaped');
			await this.delay(350);
			this.enemyVisible(true);
			await this.delay(250);
		}

		this.reset();
	};
}
