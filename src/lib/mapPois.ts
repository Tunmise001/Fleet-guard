import type { LayerSpecification } from "maplibre-gl";
import { palette, type Mode } from "@/lib/theme";

/**
 * Points of interest - restaurants, shops, landmarks, transit.
 *
 * OpenFreeMap's `positron` and `dark` styles are deliberately minimal data
 * backdrops: positron carries a single "poi" layer (water names) and dark
 * carries none at all. `liberty` has the real ones, and `dark` and `liberty`
 * were verified to share an identical `sprite` (ofm_f384), `glyphs` URL and
 * sources (`ne2_shaded`, `openmaptiles`) - so these definitions resolve
 * unchanged against the dark basemap.
 *
 * Vendored rather than fetched at runtime, for two reasons:
 *   1. They must be recoloured for dark anyway (liberty paints #666 text with
 *      a white halo, illegible on #020d18), so liberty's values are never used
 *      verbatim there.
 *   2. OpenFreeMap has no SLA. Fetching ~200KB of style JSON on every dark-mode
 *      mount adds a failure mode that silently yields a POI-less map *after*
 *      the map has already rendered.
 *
 * Trade-off accepted: drift. If OFM changes the `poi` source-layer schema or
 * its sprite icon names, these break while liberty keeps working.
 *
 * Lifted from https://tiles.openfreemap.org/styles/liberty on 2026-09-23.
 * Re-verify if the sprite hash moves off ofm_f384.
 */

/** The vector source these layers read from; absent, they cannot be added. */
export const POI_SOURCE = "openmaptiles";

const POI_LAYERS: LayerSpecification[] =
  [
    {
      "id": "water_name_point_label",
      "type": "symbol",
      "source": "openmaptiles",
      "source-layer": "water_name",
      "filter": [
        "match",
        [
          "geometry-type"
        ],
        [
          "MultiPoint",
          "Point"
        ],
        true,
        false
      ],
      "layout": {
        "text-field": [
          "case",
          [
            "has",
            "name:nonlatin"
          ],
          [
            "concat",
            [
              "get",
              "name:latin"
            ],
            "\n",
            [
              "get",
              "name:nonlatin"
            ]
          ],
          [
            "coalesce",
            [
              "get",
              "name_en"
            ],
            [
              "get",
              "name"
            ]
          ]
        ],
        "text-font": [
          "Noto Sans Italic"
        ],
        "text-letter-spacing": 0.2,
        "text-max-width": 5,
        "text-size": [
          "interpolate",
          [
            "linear"
          ],
          [
            "zoom"
          ],
          0,
          10,
          8,
          14
        ]
      },
      "paint": {
        "text-color": "#495e91",
        "text-halo-color": "rgba(255,255,255,0.7)",
        "text-halo-width": 1.5
      }
    },
    {
      "id": "poi_r20",
      "type": "symbol",
      "source": "openmaptiles",
      "source-layer": "poi",
      "minzoom": 17,
      "filter": [
        "all",
        [
          "match",
          [
            "geometry-type"
          ],
          [
            "MultiPoint",
            "Point"
          ],
          true,
          false
        ],
        [
          ">=",
          [
            "get",
            "rank"
          ],
          20
        ]
      ],
      "layout": {
        "icon-image": [
          "match",
          [
            "get",
            "subclass"
          ],
          [
            "florist",
            "furniture"
          ],
          [
            "get",
            "subclass"
          ],
          [
            "get",
            "class"
          ]
        ],
        "text-anchor": "top",
        "text-field": [
          "case",
          [
            "has",
            "name:nonlatin"
          ],
          [
            "concat",
            [
              "get",
              "name:latin"
            ],
            "\n",
            [
              "get",
              "name:nonlatin"
            ]
          ],
          [
            "coalesce",
            [
              "get",
              "name_en"
            ],
            [
              "get",
              "name"
            ]
          ]
        ],
        "text-font": [
          "Noto Sans Italic"
        ],
        "text-max-width": 9,
        "text-offset": [
          0,
          0.6
        ],
        "text-size": 12
      },
      "paint": {
        "text-color": "#666",
        "text-halo-blur": 0.5,
        "text-halo-color": "#ffffff",
        "text-halo-width": 1
      }
    },
    {
      "id": "poi_r7",
      "type": "symbol",
      "source": "openmaptiles",
      "source-layer": "poi",
      "minzoom": 16,
      "filter": [
        "all",
        [
          "match",
          [
            "geometry-type"
          ],
          [
            "MultiPoint",
            "Point"
          ],
          true,
          false
        ],
        [
          ">=",
          [
            "get",
            "rank"
          ],
          7
        ],
        [
          "<",
          [
            "get",
            "rank"
          ],
          20
        ]
      ],
      "layout": {
        "icon-image": [
          "match",
          [
            "get",
            "subclass"
          ],
          [
            "florist",
            "furniture"
          ],
          [
            "get",
            "subclass"
          ],
          [
            "get",
            "class"
          ]
        ],
        "text-anchor": "top",
        "text-field": [
          "case",
          [
            "has",
            "name:nonlatin"
          ],
          [
            "concat",
            [
              "get",
              "name:latin"
            ],
            "\n",
            [
              "get",
              "name:nonlatin"
            ]
          ],
          [
            "coalesce",
            [
              "get",
              "name_en"
            ],
            [
              "get",
              "name"
            ]
          ]
        ],
        "text-font": [
          "Noto Sans Italic"
        ],
        "text-max-width": 9,
        "text-offset": [
          0,
          0.6
        ],
        "text-size": 12
      },
      "paint": {
        "text-color": "#666",
        "text-halo-blur": 0.5,
        "text-halo-color": "#ffffff",
        "text-halo-width": 1
      }
    },
    {
      "id": "poi_r1",
      "type": "symbol",
      "source": "openmaptiles",
      "source-layer": "poi",
      "minzoom": 15,
      "filter": [
        "all",
        [
          "match",
          [
            "geometry-type"
          ],
          [
            "MultiPoint",
            "Point"
          ],
          true,
          false
        ],
        [
          ">=",
          [
            "get",
            "rank"
          ],
          1
        ],
        [
          "<",
          [
            "get",
            "rank"
          ],
          7
        ]
      ],
      "layout": {
        "icon-image": [
          "match",
          [
            "get",
            "subclass"
          ],
          [
            "florist",
            "furniture"
          ],
          [
            "get",
            "subclass"
          ],
          [
            "get",
            "class"
          ]
        ],
        "text-anchor": "top",
        "text-field": [
          "case",
          [
            "has",
            "name:nonlatin"
          ],
          [
            "concat",
            [
              "get",
              "name:latin"
            ],
            "\n",
            [
              "get",
              "name:nonlatin"
            ]
          ],
          [
            "coalesce",
            [
              "get",
              "name_en"
            ],
            [
              "get",
              "name"
            ]
          ]
        ],
        "text-font": [
          "Noto Sans Italic"
        ],
        "text-max-width": 9,
        "text-offset": [
          0,
          0.6
        ],
        "text-size": 12
      },
      "paint": {
        "text-color": "#666",
        "text-halo-blur": 0.5,
        "text-halo-color": "#ffffff",
        "text-halo-width": 1
      }
    },
    {
      "id": "poi_transit",
      "type": "symbol",
      "source": "openmaptiles",
      "source-layer": "poi",
      "filter": [
        "match",
        [
          "get",
          "class"
        ],
        [
          "airport",
          "bus",
          "rail"
        ],
        true,
        false
      ],
      "layout": {
        "icon-image": [
          "to-string",
          [
            "get",
            "class"
          ]
        ],
        "icon-size": 0.7,
        "text-anchor": "left",
        "text-field": [
          "case",
          [
            "has",
            "name:nonlatin"
          ],
          [
            "concat",
            [
              "get",
              "name:latin"
            ],
            "\n",
            [
              "get",
              "name:nonlatin"
            ]
          ],
          [
            "coalesce",
            [
              "get",
              "name_en"
            ],
            [
              "get",
              "name"
            ]
          ]
        ],
        "text-font": [
          "Noto Sans Italic"
        ],
        "text-max-width": 9,
        "text-offset": [
          0.9,
          0
        ],
        "text-size": 12
      },
      "paint": {
        "text-color": "#2e5a80",
        "text-halo-blur": 0.5,
        "text-halo-color": "#ffffff",
        "text-halo-width": 1
      }
    }
  ] as LayerSpecification[];

/**
 * Dark-mode paint. Light mode needs none: `liberty` already ships these layers
 * correctly coloured, so injection is a no-op there.
 */
const DARK_PAINT = {
  "text-color": palette.dark.fgMuted,
  "text-halo-color": palette.dark.bg,
  "text-halo-width": 1.2,
  "text-halo-blur": 0.4,
};

export function poiLayers(mode: Mode): LayerSpecification[] {
  if (mode === "light") return POI_LAYERS;
  return POI_LAYERS.map((layer) => ({
    ...layer,
    paint: { ...("paint" in layer ? layer.paint : {}), ...DARK_PAINT },
  })) as LayerSpecification[];
}
