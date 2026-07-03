import { useEffect, useState, type CSSProperties } from 'react';
import type { Player } from '../types';
import { resolvePlayerHeadUrl } from '../utils/playerHeadUrl';
import { getNextPlayerHeadFallback, type HeadFallbackStage } from '../utils/playerHeadImgError';

type HeadPlayer = Pick<
    Player,
    'memberId' | 'head_photo' | 'isTeamOwner' | 'isCaptain' | 'squadRole' | 'position'
>;

type PlayerHeadImgProps = {
    player: HeadPlayer;
    alt: string;
    className?: string;
    style?: CSSProperties;
    /** Blob or upload URL; takes precedence over role defaults. */
    srcOverride?: string | null;
};

export function PlayerHeadImg({ player, alt, className, style, srcOverride }: PlayerHeadImgProps) {
    const [fallback, setFallback] = useState<{ src: string; stage: HeadFallbackStage } | null>(null);

    useEffect(() => {
        setFallback(null);
    }, [
        player.memberId,
        player.head_photo,
        player.isCaptain,
        player.isTeamOwner,
        player.position,
        player.squadRole,
        srcOverride,
    ]);

    const src = fallback?.src ?? srcOverride ?? resolvePlayerHeadUrl(player);

    return (
        <img
            src={src}
            alt={alt}
            className={className}
            style={style}
            onError={() => {
                const next = getNextPlayerHeadFallback(src, fallback?.stage ?? '', player);
                if (next) setFallback(next);
            }}
        />
    );
}
