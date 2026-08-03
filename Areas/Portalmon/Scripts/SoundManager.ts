/**
 * SoundHandler - Manages background music and sound effects
 * 
 * Features:
 * - Single background music track that loops
 * - Random sound effects for different game events
 * - User-controlled enable/disable
 * - Automatic cleanup
 */


export class SoundHandler
{
	private readonly AUDIO_BASE_PATH = '/Areas/Portalmon/Content/Sound/';
	private readonly MOVE_AUDIO_BASE_PATH = this.AUDIO_BASE_PATH + 'Moves/';

	
	// Background Music
	private readonly INTRO_MUSIC = this.AUDIO_BASE_PATH + 'intro.mp3';
	private readonly BATTLE_MUSIC = this.AUDIO_BASE_PATH + "battle.wav"
	private readonly BOSS_MUSIC = this.AUDIO_BASE_PATH + '4000K.mp3';
	private readonly BACKGROUND_MUSIC = this.AUDIO_BASE_PATH + 'radioLoop.mp3';
	private readonly GYM_MUSIC = this.AUDIO_BASE_PATH + 'gym.mp3';
	private readonly CHAMPION_MUSIC = this.AUDIO_BASE_PATH + 'champion.mp3';
	private readonly CREDITS_MUSIC = this.AUDIO_BASE_PATH + 'StillAlive.mp3';


	private readonly CONTAIN_SOUND = this.AUDIO_BASE_PATH + 'contain.mp3';
	private readonly BATTLE_START_SOUND = this.AUDIO_BASE_PATH + 'battleStart.wav';
	private readonly THROW_SOUND = this.AUDIO_BASE_PATH + 'throw.wav';
	private readonly WIGGLE_SOUND = this.AUDIO_BASE_PATH + 'wiggle.wav';
	private readonly ON_SOUND = this.AUDIO_BASE_PATH + 'on.wav';
	private readonly HEAL_SOUND = this.AUDIO_BASE_PATH + 'rest.mp3';

	// ========================================
	// Private Properties
	// ========================================
	private introMusic: HTMLAudioElement | null = null;
	private battleMusic: HTMLAudioElement | null = null;
	private backgroundMusic: HTMLAudioElement | null = null;
	private gymMusic: HTMLAudioElement | null = null;
	private bossMusic: HTMLAudioElement | null = null;
	private championMusic: HTMLAudioElement | null = null;
	private creditsMusic: HTMLAudioElement | null = null;
	private currentMusicTrack: HTMLAudioElement | null = null; // Track which music is playing

	private moveSounds: Record<string, HTMLAudioElement> = {};
	private containSound: HTMLAudioElement | null = null;
	private victorySound: HTMLAudioElement | null = null;
	private onSound: HTMLAudioElement | null = null;
	private throwSound: HTMLAudioElement | null = null;
	private wiggleSound: HTMLAudioElement | null = null;
	private battleStartSound: HTMLAudioElement | null = null;
	private healSound: HTMLAudioElement | null = null;

	private isSoundEnabled: boolean;
	private musicVolume: number = 0.3; // 30% volume for background music
	private sfxVolume: number = 0.5; // 50% volume for sound effects

	/**
	 * Initialize the sound handler - loads all audio files
	 */
	constructor(enabled: boolean)
	{
		this.isSoundEnabled = enabled;

		// Initialize background music
		this.introMusic = new Audio(this.INTRO_MUSIC);
		this.introMusic.loop = true;
		this.introMusic.volume = this.musicVolume;

		// Initialize boss music
		this.bossMusic = new Audio(this.BOSS_MUSIC);
		this.bossMusic.loop = true;
		this.bossMusic.volume = this.musicVolume;

		// Initialize battle music
		this.battleMusic = new Audio(this.BATTLE_MUSIC);
		this.battleMusic.loop = true;
		this.battleMusic.volume = this.musicVolume;

		// Initialize background music
		this.backgroundMusic = new Audio(this.BACKGROUND_MUSIC);
		this.backgroundMusic.loop = true;
		this.backgroundMusic.volume = this.musicVolume;

		// Initialize gym music
		this.gymMusic = new Audio(this.GYM_MUSIC);
		this.gymMusic.loop = true;
		this.gymMusic.volume = this.musicVolume;

		// Initialize champion music
		this.championMusic = new Audio(this.CHAMPION_MUSIC);
		this.championMusic.loop = true;
		this.championMusic.volume = this.musicVolume;

		// Initialize champion music
		this.creditsMusic = new Audio(this.CREDITS_MUSIC);
		this.creditsMusic.loop = true;
		this.creditsMusic.volume = this.musicVolume;

		this.onSound = this.createSoundEffect(this.ON_SOUND);
		this.throwSound = this.createSoundEffect(this.THROW_SOUND);
		this.wiggleSound = this.createSoundEffect(this.WIGGLE_SOUND);
		this.battleStartSound = this.createSoundEffect(this.BATTLE_START_SOUND);
		this.containSound = this.createSoundEffect(this.CONTAIN_SOUND);
		this.healSound = this.createSoundEffect(this.HEAL_SOUND);
	}

	/**
	 * Helper to create a sound effect with proper settings
	 */
	private createSoundEffect(path: string): HTMLAudioElement
	{
		const sound = new Audio(path);
		sound.volume = this.sfxVolume;
		sound.preload = 'auto';
		return sound;
	}

	private getMoveSoundEffect(fileName: string): HTMLAudioElement
	{
		const cached = this.moveSounds[fileName];
		if (cached) return cached;

		const sound = this.createSoundEffect(this.MOVE_AUDIO_BASE_PATH + fileName);
		this.moveSounds[fileName] = sound;
		return sound;
	}

	/**
	 * Start playing background music
	 */
	public playIntroMusic(): void
	{
		if (!this.isSoundEnabled || !this.introMusic) return;

		// Stop any currently playing music
		this.stopAllMusic();

		// Set background music as current track
		this.currentMusicTrack = this.introMusic;
		this.currentMusicTrack.currentTime = 0;

		this.currentMusicTrack.play().catch(() => {});
	}

	/**
	 * Start playing background music
	 */
	public playBattleMusic(): void
	{
		if (!this.isSoundEnabled || !this.battleMusic) return;

		// Stop any currently playing music
		this.stopAllMusic();

		// Set background music as current track
		this.currentMusicTrack = this.battleMusic;
		this.currentMusicTrack.currentTime = 0;

		this.currentMusicTrack.play().catch(() => {});
	}

	/**
	 * Start playing background music
	 */
	public playGymMusic(): void
	{
		if (!this.isSoundEnabled || !this.gymMusic) return;

		// Stop any currently playing music
		this.stopAllMusic();

		// Set background music as current track
		this.currentMusicTrack = this.gymMusic;
		this.currentMusicTrack.currentTime = 0;

		this.currentMusicTrack.play().catch(() => {});
	}

	/**
	* Start playing background music
	*/
	public playChampionMusic(): void
	{
		if (!this.isSoundEnabled || !this.championMusic) return;

		// Stop any currently playing music
		this.stopAllMusic();

		// Set background music as current track
		this.currentMusicTrack = this.championMusic;
		this.currentMusicTrack.currentTime = 0;

		this.currentMusicTrack.play().catch(() => { });
	}

	/**
	* Start playing credits music
	*/
	public playCreditsMusic(): void
	{
		if (!this.isSoundEnabled || !this.creditsMusic) return;

		// Stop any currently playing music
		this.stopAllMusic();

		// Set background music as current track
		this.currentMusicTrack = this.creditsMusic;
		this.currentMusicTrack.currentTime = 0;

		this.currentMusicTrack.play().catch(() => { });
	}

	/**
 * Start playing background music
 */
	public playBackgroundMusic(): void
	{
		if (!this.isSoundEnabled || !this.backgroundMusic) return;

		// Stop any currently playing music
		this.stopAllMusic();

		// Set background music as current track
		this.currentMusicTrack = this.backgroundMusic;
		this.currentMusicTrack.currentTime = 0;

		this.currentMusicTrack.play().catch(() => {});
	}

	/**
	 * Start playing boss music (replaces background music)
	 */
	public playBossMusic(): void
	{
		if (!this.isSoundEnabled || !this.bossMusic) return;

		// Stop any currently playing music
		this.stopAllMusic();

		// Set boss music as current track
		this.currentMusicTrack = this.bossMusic;
		this.currentMusicTrack.currentTime = 0;

		this.currentMusicTrack.play().catch(() => {});
	}

	/**
	 * Stop all music tracks
	 */
	private stopAllMusic(): void
	{
		if (this.introMusic)
		{
			this.introMusic.pause();
			this.introMusic.currentTime = 0;
		}

		if (this.backgroundMusic)
		{
			this.backgroundMusic.pause();
			this.backgroundMusic.currentTime = 0;
		}

		if (this.gymMusic)
		{
			this.gymMusic.pause();
			this.gymMusic.currentTime = 0;
		}

		if (this.championMusic)
		{
			this.championMusic.pause();
			this.championMusic.currentTime = 0;
		}

		if (this.battleMusic)
		{
			this.battleMusic.pause();
			this.battleMusic.currentTime = 0;
		}

		if (this.bossMusic)
		{
			this.bossMusic.pause();
			this.bossMusic.currentTime = 0;
		}

		if (this.creditsMusic)
		{
			this.creditsMusic.pause();
			this.creditsMusic.currentTime = 0;
		}

		this.currentMusicTrack = null;
	}

	/**
	 * Stop current music (public method for external use)
	 */
	public stopBackgroundMusic(): void
	{
		this.stopAllMusic();
	}

	/**
	 * Play a move sound effect by file name
	 */
	public playMoveSound(fileName?: string, onEnded?: () => void): void
	{
		if (!this.isSoundEnabled || !fileName) return;
		this.playSoundEffect(this.getMoveSoundEffect(fileName), onEnded);
	}

	/**
	 * Play catch sound effect
	 */
	public playContainSound(): void
	{
		if (!this.isSoundEnabled || !this.containSound) return;
		this.playSoundEffect(this.containSound);
	}

	/**
	 * Play victory sound effect
	 */
	public playBattleStartSound(): void
	{
		if (!this.isSoundEnabled || !this.battleStartSound) return;
		this.playSoundEffect(this.battleStartSound, () => this.playBattleMusic());
	}

	/**
	 * Play heal/rest sound effect
	 */
	public playRestSound(): void
	{
		if (!this.isSoundEnabled || !this.healSound) return;
		this.playSoundEffect(this.healSound);
	}

	/**
	 * Play ultimate sound effect
	 * @param moveName
	 * @param onEnded
	 * @returns
	 */
	public playUltSound(moveName?: string, onEnded?: () => void): void
	{
		if (!this.isSoundEnabled || !moveName) return;
		this.playSoundEffect(this.getMoveSoundEffect(moveName), onEnded);
	}

	/**
	 * Play victory sound effect
	 */
	public playVictorySound(): void
	{
		if (!this.isSoundEnabled || !this.victorySound) return;
		this.playSoundEffect(this.victorySound);
	}

	/**
	 * Play turn on sound effect
	 */
	public playOnSound(): void
	{
		if (!this.isSoundEnabled || !this.onSound) return;
		this.playSoundEffect(this.onSound);
	}

	/**
	 * Play throw sound effect
	 */
	public playThrowSound(): void
	{
		if (!this.isSoundEnabled || !this.onSound) return;
		this.playSoundEffect(this.throwSound);
	}

	/**
	 * Play wiggle sound effect
	 */
	public playWigglesound(): void
	{
		if (!this.isSoundEnabled || !this.onSound) return;
		this.playSoundEffect(this.wiggleSound);
	}

	/**
	 * Helper method to play a sound effect (handles cloning and cleanup)
	 */
	private playSoundEffect(sound: HTMLAudioElement, onEnded?: () => void): void
	{
		// Clone the audio element so multiple sounds can play simultaneously
		const soundClone = sound.cloneNode(true) as HTMLAudioElement;
		soundClone.volume = this.sfxVolume;

		const playPromise = soundClone.play();

		if (playPromise !== undefined)
		{
			playPromise.catch((error) =>
			{
				console.warn('Sound effect failed to play:', error);
			});
		}

		// Clean up the clone after it finishes
		soundClone.addEventListener('ended', () =>
		{
			soundClone.remove();
			onEnded?.();  // Play something else if applicable
		});
	}

	/**
	 * Toggle sound on/off
	 * @returns New sound state (true = enabled, false = disabled)
	 */
	public toggleSound(): boolean
	{
		this.isSoundEnabled = !this.isSoundEnabled;

		if (!this.isSoundEnabled)
		{
			this.stopAllMusic();
		}
		else
		{
			// Resume whichever track was set as current
			if (this.currentMusicTrack === this.bossMusic)
			{
				this.playBossMusic();
			}
			else if (this.currentMusicTrack === this.championMusic)
			{
				this.playChampionMusic();
			}
			else if (this.currentMusicTrack === this.backgroundMusic)
			{
				this.playBackgroundMusic();
			}
			else if (this.currentMusicTrack === this.gymMusic)
			{
				this.playGymMusic();
			}
			else if (this.currentMusicTrack === this.creditsMusic)
			{
				this.playCreditsMusic();
			}
			else if (this.currentMusicTrack === this.introMusic)
			{
				this.playIntroMusic();
			}
		}

		return this.isSoundEnabled;
	}

	/**
	 * Set sound enabled state
	 * @param enabled - Whether sound should be enabled
	 */
	public setSoundEnabled(enabled: boolean): void
	{
		if (this.isSoundEnabled === enabled) return;

		this.isSoundEnabled = enabled;

		if (!enabled)
		{
			this.stopAllMusic();
		}
		else
		{
			// Resume whichever track was set as current
			if (this.currentMusicTrack === this.bossMusic)
			{
				this.playBossMusic();
			}
			else
			{
				this.playBattleMusic();
			}
		}
	}

	/**
	 * Set background music volume
	 * @param volume - Volume level (0.0 to 1.0)
	 */
	public setMusicVolume(volume: number): void
	{
		this.musicVolume = Math.max(0, Math.min(1, volume));

		if (this.battleMusic)
		{
			this.battleMusic.volume = this.musicVolume;
		}

		if (this.bossMusic)
		{
			this.bossMusic.volume = this.musicVolume;
		}
	}

	/**
	 * Set sound effects volume
	 * @param volume - Volume level (0.0 to 1.0)
	 */
	public setSfxVolume(volume: number): void
	{
		this.sfxVolume = Math.max(0, Math.min(1, volume));
		for (const key in this.moveSounds)
		{
			this.moveSounds[key].volume = this.sfxVolume;
		}
	}

	/**
	 * Clean up audio resources
	 */
	public cleanup(): void
	{
		this.stopAllMusic();

		if (this.battleMusic)
		{
			this.battleMusic.remove();
			this.battleMusic = null;
		}

		if (this.bossMusic)
		{
			this.bossMusic.remove();
			this.bossMusic = null;
		}

		if (this.gymMusic)
		{
			this.gymMusic.remove();
			this.gymMusic = null;
		}

		if (this.backgroundMusic)
		{
			this.bossMusic.remove();
			this.bossMusic = null;
		}

		if (this.championMusic)
		{
			this.championMusic.remove();
			this.championMusic = null;
		}

		if (this.creditsMusic)
		{
			this.creditsMusic.remove();
			this.creditsMusic = null;
		}

		if (this.introMusic)
		{
			this.bossMusic.remove();
			this.bossMusic = null;
		}

		this.currentMusicTrack = null;

		for (const key in this.moveSounds)
		{
			this.moveSounds[key].remove();
		}
		this.moveSounds = {};

		if (this.containSound)
		{
			this.containSound.remove();
			this.containSound = null;
		}

		if (this.victorySound)
		{
			this.victorySound.remove();
			this.victorySound = null;
		}

		if (this.onSound)
		{
			this.onSound.remove();
			this.onSound = null;
		}
	}
}
