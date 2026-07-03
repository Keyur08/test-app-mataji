import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View, LayoutChangeEvent } from 'react-native';

interface MarqueeProps {
    text: string;
    speed?: number; // Pixels per second
    textStyle?: object;
}

export const Marquee: React.FC<MarqueeProps> = ({ text, speed = 60, textStyle }) => {
    const animatedValue = useRef(new Animated.Value(0)).current;
    const [textWidth, setTextWidth] = useState(0);
    const [containerWidth, setContainerWidth] = useState(0);

    useEffect(() => {
        if (textWidth > 0 && containerWidth > 0) {
            animatedValue.setValue(0);

            // Calculate dynamic duration based on the actual measured width
            const calculatedDuration = (textWidth / speed) * 1000;

            const animation = Animated.loop(
                Animated.timing(animatedValue, {
                    toValue: -textWidth,
                    duration: calculatedDuration,
                    easing: Easing.linear,
                    useNativeDriver: true,
                })
            );

            animation.start();

            return () => animation.stop();
        }
    }, [textWidth, containerWidth, speed, text]);

    const handleTextLayout = (e: LayoutChangeEvent) => {
        const measuredWidth = e.nativeEvent.layout.width;
        // Only update if the measured width is valid and larger than 0
        if (measuredWidth > 0) {
            setTextWidth(measuredWidth);
        }
    };

    const handleContainerLayout = (e: LayoutChangeEvent) => {
        setContainerWidth(e.nativeEvent.layout.width);
    };

    return (
        <View style={styles.container} onLayout={handleContainerLayout}>
            <Animated.View
                style={[
                    styles.animatedContainer,
                    {
                        transform: [{ translateX: animatedValue }],
                    },
                ]}
            >
                {/*
                  We wrap the text blocks in an unconstrained row
                  so that the inner text can expand as far right as it needs to
                  without being restricted by the device screen size.
                */}
                <View style={styles.rowWithoutBounds}>
                    {/* Original Text */}
                    <Text
                        style={[styles.text, textStyle]}
                        onLayout={handleTextLayout}
                        numberOfLines={1}
                        ellipsizeMode="clip"
                    >
                        {text}
                    </Text>

                    {/* Duplicated Text */}
                    <Text
                        style={[styles.text, textStyle]}
                        numberOfLines={1}
                        ellipsizeMode="clip"
                    >
                        {text}
                    </Text>
                </View>
            </Animated.View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        width: '100%',
        overflow: 'hidden',        // Keeps the text hidden outside left/right edges
        flexDirection: 'row',
        alignItems: 'center',
    },
    animatedContainer: {
        flexDirection: 'row',
    },
    rowWithoutBounds: {
        flexDirection: 'row',
        // Critical fix: allows the child texts to grow past the screen bounds
        // horizontally so onLayout captures their true, complete width.
        flexWrap: 'nowrap',
    },
    text: {
        paddingRight: 40,
        fontSize: 16,
    },
});