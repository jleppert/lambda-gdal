#!/usr/bin/env bash
# this script generates a tileset from an original georeferenced float32 DSM GeoTif and an RGBA PNG where each channel represents a byte of the 32 bit float
# usage: tiles.sh <dsm> <png> <zoom range>
# example: tile.sh dsm.tif dsm.png 18-22
# outputs: the directory that contains the tileset
dsm=$1
inputPng=$2
zoom=$3
outputDir=/tmp/$(cat /dev/urandom | tr -cd 'a-f0-9' | head -c 32)
outputPng=$(cat /dev/urandom | tr -cd 'a-f0-9' | head -c 32).png

# replace these variables with the locations of these gdal utilities
gdalbuildvrt=$(which gdalbuildvrt)
gdal2tiles=$(which gdal2tiles.py)
gdalsrsinfo=$(which gdalsrsinfo)
gdalinfo=$(which gdalinfo)
gdal_translate=$(which gdal_translate)

function gdal_extent() {
    EXTENT=$($gdalinfo $1 |\
        grep "Upper Left\|Lower Right" |\
        sed "s/Upper Left  //g;s/Lower Right //g;s/).*//g" |\
        tr "\n" " " |\
        sed 's/ *$//g' |\
        tr -d "[(,]")
    echo -n "$EXTENT"
}

function nodata_value() {
  NODATA=$($gdalinfo $1 |\
    grep "NoData Value=" |\
    sed "s/NoData Value=//g" |\
    xargs)
  echo -n "$NODATA"  
}

srs=$(gdalsrsinfo -o wkt $dsm)
extent=$(gdal_extent $dsm)
nodata=$(nodata_value $dsm)

translate="$gdal_translate -of PNG -a_ullr $extent -a_srs $srs $inputPng $outputDir/$outputPng"
vrt="$gdalbuildvrt -srcnodata $nodata -hidenodata $outputDir/png.vrt $outputDir/$outputPng"
tile="$gdal2tiles -p mercator -z $zoom $outputDir/png.vrt -r near -w none"

mkdir -p $outputDir
eval $translate
eval $vrt
cd $outputDir
eval $tile
echo -n "Tiles generated to: " $outputDir
