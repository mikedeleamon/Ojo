import { buildStoryOptions } from '../storyOptions';

const APP_ID = '1234567890';
const PNG = 'data:image/png;base64,AAAA';
const VIDEO = 'file:///var/mobile/Caches/library/loops__rain.8b21d0aa.mp4';

describe('buildStoryOptions', () => {
  it('passes an image Story through unchanged, with the default background colors', () => {
    expect(buildStoryOptions({ kind: 'image', backgroundImage: PNG }, APP_ID)).toEqual({
      appId: APP_ID,
      backgroundImage: PNG,
      backgroundTopColor: '#0F172A',
      backgroundBottomColor: '#1E293B',
    });
  });

  it('maps a video Story to backgroundVideo + stickerImage and no backgroundImage', () => {
    const options = buildStoryOptions(
      { kind: 'video', backgroundVideo: VIDEO, stickerImage: PNG, backgroundTopColor: '#000000' },
      APP_ID,
    );
    expect(options).toEqual({
      appId: APP_ID,
      backgroundVideo: VIDEO,
      stickerImage: PNG,
      backgroundTopColor: '#000000',
      backgroundBottomColor: '#1E293B',
    });
    expect(options).not.toHaveProperty('backgroundImage');
  });

  it('refuses a video that is not a file:// URI', () => {
    for (const backgroundVideo of [
      'https://pub.example.r2.dev/library/v1/loops/rain.8b21d0aa.mp4',
      'ph://ABC-123',
      '/var/mobile/Caches/library/loops__rain.mp4',
    ]) {
      expect(buildStoryOptions({ kind: 'video', backgroundVideo, stickerImage: PNG }, APP_ID)).toBeNull();
    }
  });

  it('keeps the attribution link in both modes and drops an empty one', () => {
    const link = 'https://ojo.example/s/weather';
    expect(buildStoryOptions({ kind: 'image', backgroundImage: PNG, attributionURL: link }, APP_ID))
      .toHaveProperty('attributionURL', link);
    expect(buildStoryOptions({ kind: 'video', backgroundVideo: VIDEO, stickerImage: PNG, attributionURL: link }, APP_ID))
      .toHaveProperty('attributionURL', link);
    expect(buildStoryOptions({ kind: 'image', backgroundImage: PNG, attributionURL: null }, APP_ID))
      .not.toHaveProperty('attributionURL');
  });
});
