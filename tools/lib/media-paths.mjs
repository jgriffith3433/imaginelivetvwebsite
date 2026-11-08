// Where the poster and the phone rendition of a clip live (made by tools/make-posters.mjs, linked by tools/build-story.mjs).
import path from 'node:path';
export const posterPath = (video) => path.posix.join(path.posix.dirname(video), 'poster', path.posix.basename(video, '.mp4') + '.webp');
export const smallPath = (video) => path.posix.join(path.posix.dirname(video), 'sm', path.posix.basename(video));
export const webpPath = (image) => image.replace(/\.jpg$/, '.webp');
