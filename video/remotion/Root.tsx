import React from 'react';
import { Composition, AbsoluteFill } from 'remotion';
import { Demo, DEMO_FRAMES } from './Demo';
import { FontLoader } from './ui';
import { Thumb } from './Thumb';

const WithFonts: React.FC<{ C: React.FC }> = ({ C }) => (
  <AbsoluteFill>
    <FontLoader />
    <C />
  </AbsoluteFill>
);

export const Root: React.FC = () => (
  <>
    <Composition id="Demo" component={() => <WithFonts C={Demo} />} durationInFrames={DEMO_FRAMES} fps={60} width={1920} height={1080} />
    <Composition id="DemoThumb" component={() => <WithFonts C={Thumb} />} durationInFrames={1} fps={30} width={1920} height={1080} />
  </>
);
