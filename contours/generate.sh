#!/usr/bin/env bash
# this script generates and tiles contours from a DSM
# usage: contours.sh <dsm.tif> <interval> <style> <zoom>
# example: contours.sh dsm.tif 1.0 default.xml 15-22
# outputs: the directory that contains the tileset
dsm=$1
interval=$2
style=$3
zoom=$4
outputDir=/tmp/$(cat /dev/urandom | tr -cd 'a-f0-9' | head -c 32)
outputPng=$(cat /dev/urandom | tr -cd 'a-f0-9' | head -c 32).png

# replace these variables with the locations of these gdal utilities
gdalbuildvrt=$(which gdalbuildvrt)
gdal2tiles=$(which gdal2tiles.py)
gdalsrsinfo=$(which gdalsrsinfo)
gdalinfo=$(which gdalinfo)
gdal_translate=$(which gdal_translate)
gdal_contour=$(which gdal_contour)
nik2img=$(which nik2img.py)

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

function dimensions_value() {
  DIMENSIONS="7863 6288"
  echo -n "$DIMENSIONS"
}

base_style=$(cat $style)
srs=$(gdalsrsinfo -o wkt $dsm)
proj4=$(gdalsrsinfo -o proj4 $dsm | tr "'" " " | xargs)
style=${base_style/\$proj4/$proj4} 
outputShp="$outputDir/contours.shp"
style=${style/\$shapefile/$outputShp}
destStyle="$outputDir/style.xml"
extent=$(gdal_extent $dsm)
nodata=$(nodata_value $dsm)
dimensions=$(dimensions_value $dsm)

contour="$gdal_contour -a height $dsm -i 1.0 $outputDir/contours.shp"
translate="$gdal_translate -of VRT -a_ullr $extent -a_srs $srs $outputDir/$outputPng $outputDir/contours.vrt"
map="$nik2img $destStyle $outputDir/$outputPng -d $dimensions -e $extent"
tile="$gdal2tiles -p mercator -z $zoom $outputDir/contours.vrt"

mkdir -p $outputDir
echo "$style" >> "$destStyle"
eval $contour
eval $map
eval $translate
cd $outputDir
eval $tile
echo -n "Contour tiles generated to: " $outputDir
