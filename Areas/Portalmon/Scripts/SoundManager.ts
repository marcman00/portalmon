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
	/**
	 * Music and effect elements are created on first use, keyed by URL.
	 *
	 * Creating every element up front made the browser open one request per
	 * track the moment the page parsed, before the player had even powered the
	 * handheld on. Thirteen parallel media downloads compete with the rest of
	 * the host page for connections and bandwidth, and the player may never
	 * reach most of those tracks in a session.
	 */
	private readonly musicTracks: Record<string, HTMLAudioElement> = {};
	/** Round-robin pools of effect elements, keyed by URL. */
	private readonly effectPools: Record<string, HTMLAudioElement[]> = {};
	/** URL of the track that should be playing, independent of whether sound is on. */
	private currentMusicPath: string | null = null;

	private isSoundEnabled: boolean;
	private musicVolume: number = 0.3; // 30% volume for background music
	private sfxVolume: number = 0.5; // 50% volume for sound effects

	/** How many simultaneous copies of one effect can overlap. */
	private static readonly EFFECT_POOL_SIZE = 4;

	constructor(enabled: boolean)
	{
		this.isSoundEnabled = enabled;
	}

	/**
	 * Returns the looping music element for a URL, creating it on first use.
	 * preload is 'none' so nothing is fetched until the track actually plays.
	 */
	private getMusicTrack(path: string): HTMLAudioElement
	{
		const cached = this.musicTracks[path];
		if (cached) return cached;

		const track = new Audio();
		track.preload = 'none';
		track.src = path;
		track.loop = true;
		track.volume = this.musicVolume;
		this.musicTracks[path] = track;
		return track;
	}

	/**
	 * Returns a free element from the pool for a URL, or the oldest one if all
	 * copies are still playing. Reusing a fixed set of elements avoids the
	 * unbounded cloneNode-per-play churn the previous implementation had.
	 */
	private getEffect(path: string): HTMLAudioElement
	{
		const pool = this.effectPools[path] ?? (this.effectPools[path] = []);
		const free = pool.find(candidate => candidate.paused || candidate.ended);
		if (free) return free;

		if (pool.length < SoundHandler.EFFECT_POOL_SIZE)
		{
			const sound = new Audio();
			// 'auto' is correct here: the first play of an effect should not
			// stall, and effects are small compared with the music tracks.
			sound.preload = 'auto';
			sound.src = path;
			sound.volume = this.sfxVolume;
			pool.push(sound);
			return sound;
		}

		return pool[0];
	}

	private getMoveSoundPath(fileName: string): string
	{
		return this.MOVE_AUDIO_BASE_PATH + fileName;
	}

	/**
	 * Opt-in warm-up for the effects the player is about to need. Call this
	 * after power-on rather than fetching everything during page load.
	 */
	public preloadCoreEffects(): void
	{
		for (const path of [this.ON_SOUND, this.THROW_SOUND, this.WIGGLE_SOUND, this.BATTLE_START_SOUND, this.CONTAIN_SOUND, this.HEAL_SOUND])
		{
			this.getEffect(path).load();
		}
	}

	/**
	 * Starts fetching a track without playing it. Music elements are created
	 * with preload='none', so the first play of a track otherwise begins its
	 * download at the moment it is supposed to be audible. Callers use this
	 * when they know a switch is coming and have animation time to hide it in.
	 */
	private warmUpMusic(path: string): void
	{
		const track = this.getMusicTrack(path);
		if (track.preload === 'auto') return;
		track.preload = 'auto';
		track.load();
	}

	/** Warm the track a wild encounter switches to after its start sting. */
	public warmUpBattleMusic(): void { this.warmUpMusic(this.BATTLE_MUSIC); }

	/**
	 * Switches to a track, stopping whatever was playing. The track element and
	 * its download are created here, on demand, rather than at construction.
	 */
	private playMusic(path: string): void
	{
		this.stopAllMusic();
		this.currentMusicPath = path;
		if (!this.isSoundEnabled) return;

		const track = this.getMusicTrack(path);
		track.currentTime = 0;
		track.play().catch(() => {});
	}

	public playIntroMusic(): void { this.playMusic(this.INTRO_MUSIC); }

	public playBattleMusic(): void { this.playMusic(this.BATTLE_MUSIC); }

	public playGymMusic(): void { this.playMusic(this.GYM_MUSIC); }

	public playChampionMusic(): void { this.playMusic(this.CHAMPION_MUSIC); }

	public playCreditsMusic(): void { this.playMusic(this.CREDITS_MUSIC); }

	public playBackgroundMusic(): void { this.playMusic(this.BACKGROUND_MUSIC); }

	/**
	 * Start playing boss music (replaces background music)
	 */
	public playBossMusic(): void { this.playMusic(this.BOSS_MUSIC); }

	/**
	 * Stop every track that has actually been created. Tracks the player never
	 * reached were never instantiated and need no cleanup.
	 */
	private stopAllMusic(): void
	{
		for (const key in this.musicTracks)
		{
			const track = this.musicTracks[key];
			track.pause();
			track.currentTime = 0;
		}

		this.currentMusicPath = null;
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
		this.playSoundEffect(this.getMoveSoundPath(fileName), onEnded);
	}

	/**
	 * Play catch sound effect
	 */
	public playContainSound(): void
	{
		if (!this.isSoundEnabled) return;
		this.playSoundEffect(this.CONTAIN_SOUND);
	}

	/**
	 * Play victory sound effect
	 */
	public playBattleStartSound(): void
	{
		if (!this.isSoundEnabled) return;
		this.playSoundEffect(this.BATTLE_START_SOUND, () => this.playBattleMusic());
	}

	/**
	 * Play heal/rest sound effect
	 */
	public playRestSound(): void
	{
		if (!this.isSoundEnabled) return;
		this.playSoundEffect(this.HEAL_SOUND);
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
		this.playSoundEffect(this.getMoveSoundPath(moveName), onEnded);
	}

	/**
	 * Play turn on sound effect
	 */
	public playOnSound(): void
	{
		if (!this.isSoundEnabled) return;
		this.playSoundEffect(this.ON_SOUND);
	}

	/**
	 * Play throw sound effect
	 */
	public playThrowSound(): void
	{
		if (!this.isSoundEnabled) return;
		this.playSoundEffect(this.THROW_SOUND);
	}

	/**
	 * Play wiggle sound effect
	 */
	public playWigglesound(): void
	{
		if (!this.isSoundEnabled) return;
		this.playSoundEffect(this.WIGGLE_SOUND);
	}

	/**
	 * Plays an effect from the pool for its URL.
	 *
	 * The 'ended' listener is registered once per play with { once: true }, and
	 * a rejected play() still invokes onEnded so callers that chain music off
	 * an effect are not left waiting on an event that will never fire.
	 */
	private playSoundEffect(path: string, onEnded?: () => void): void
	{
		const sound = this.getEffect(path);
		sound.volume = this.sfxVolume;
		sound.currentTime = 0;

		let finished = false;
		const finish = (): void =>
		{
			if (finished) return;
			finished = true;
			onEnded?.();
		};

		sound.addEventListener('ended', finish, { once: true });

		const playPromise = sound.play();
		if (playPromise !== undefined)
		{
			playPromise.catch((error) =>
			{
				console.warn('Sound effect failed to play:', error);
				sound.removeEventListener('ended', finish);
				finish();
			});
		}
	}

	/**
	 * Toggle sound on/off
	 * @returns New sound state (true = enabled, false = disabled)
	 */
	public toggleSound(): boolean
	{
		this.setSoundEnabled(!this.isSoundEnabled);
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
			// Pause in place; keep currentMusicPath so re-enabling resumes the
			// same track instead of guessing at battle music.
			const resumePath = this.currentMusicPath;
			this.stopAllMusic();
			this.currentMusicPath = resumePath;
			return;
		}

		if (this.currentMusicPath) this.playMusic(this.currentMusicPath);
	}

	/**
	 * Set background music volume
	 * @param volume - Volume level (0.0 to 1.0)
	 */
	public setMusicVolume(volume: number): void
	{
		this.musicVolume = Math.max(0, Math.min(1, volume));
		for (const key in this.musicTracks)
		{
			this.musicTracks[key].volume = this.musicVolume;
		}
	}

	/**
	 * Set sound effects volume
	 * @param volume - Volume level (0.0 to 1.0)
	 */
	public setSfxVolume(volume: number): void
	{
		this.sfxVolume = Math.max(0, Math.min(1, volume));
		for (const key in this.effectPools)
		{
			for (const sound of this.effectPools[key]) sound.volume = this.sfxVolume;
		}
	}

	/**
	 * Release every audio element and drop its buffered data. Detaching src and
	 * calling load() is what actually frees the decoded audio; the previous
	 * implementation only called remove(), which does nothing for elements that
	 * were never in the document.
	 */
	public cleanup(): void
	{
		this.stopAllMusic();

		const release = (sound: HTMLAudioElement): void =>
		{
			sound.pause();
			sound.removeAttribute('src');
			sound.load();
		};

		for (const key in this.musicTracks)
		{
			release(this.musicTracks[key]);
			delete this.musicTracks[key];
		}

		for (const key in this.effectPools)
		{
			for (const sound of this.effectPools[key]) release(sound);
			delete this.effectPools[key];
		}

		this.currentMusicPath = null;
	}
}
