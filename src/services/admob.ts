import { AdMob, BannerAdSize, BannerAdPosition, RewardAdPluginEvents } from '@capacitor-community/admob';
import type { BannerAdOptions, AdOptions } from '@capacitor-community/admob';
import { Capacitor } from '@capacitor/core';

export class AdMobService {
  private static isInitialized = false;

  public static async initialize(): Promise<void> {
    if (!Capacitor.isNativePlatform()) {
      console.warn('AdMob is only available on native platforms.');
      return;
    }

    try {
      await AdMob.initialize();
      this.isInitialized = true;
      console.log('AdMob initialized successfully');
    } catch (error) {
      console.error('Failed to initialize AdMob', error);
    }
  }

  public static async showBanner(): Promise<void> {
    if (!this.isInitialized || !Capacitor.isNativePlatform()) return;

    try {
      const options: BannerAdOptions = {
        adId: 'YOUR_BANNER_AD_UNIT_ID', // Replace with real ID
        adSize: BannerAdSize.BANNER,
        position: BannerAdPosition.BOTTOM_CENTER,
        margin: 0,
        isTesting: true, // Remove in production
      };
      await AdMob.showBanner(options);
    } catch (error) {
      console.error('Failed to show banner', error);
    }
  }

  public static async hideBanner(): Promise<void> {
    if (!this.isInitialized || !Capacitor.isNativePlatform()) return;

    try {
      await AdMob.hideBanner();
    } catch (error) {
      console.error('Failed to hide banner', error);
    }
  }

  public static async showInterstitial(): Promise<void> {
    if (!this.isInitialized || !Capacitor.isNativePlatform()) {
      console.warn('Interstitial simulated on web.');
      return;
    }

    try {
      const options: AdOptions = {
        adId: 'YOUR_INTERSTITIAL_AD_UNIT_ID', // Replace with real ID
        isTesting: true, // Remove in production
      };
      await AdMob.prepareInterstitial(options);
      await AdMob.showInterstitial();
    } catch (error) {
      console.error('Failed to show interstitial', error);
    }
  }

  public static async showRewarded(onReward: () => void): Promise<void> {
    if (!this.isInitialized || !Capacitor.isNativePlatform()) {
      console.warn('Rewarded ad simulated on web. Firing reward callback directly.');
      onReward();
      return;
    }

    try {
      const options: AdOptions = {
        adId: 'YOUR_REWARDED_AD_UNIT_ID', // Replace with real ID
        isTesting: true, // Remove in production
      };
      await AdMob.prepareRewardVideoAd(options);

      // Listen for the reward event
      const listener = await AdMob.addListener(RewardAdPluginEvents.Rewarded, (rewardItem: any) => {
        console.log('User was rewarded', rewardItem);
        onReward();
        listener.remove();
      });

      const dismissListener = await AdMob.addListener(RewardAdPluginEvents.Dismissed, () => {
         listener.remove();
         dismissListener.remove();
      });

      await AdMob.showRewardVideoAd();
    } catch (error) {
      console.error('Failed to show rewarded video', error);
    }
  }
}
